// Optional dbt build step: run `dbt deps` + `dbt docs generate` in a project so
// the mapper can read warehouse-introspected column types from target/catalog.json.
// This is opt-in (--build) because it connects to the warehouse and writes dbt's
// standard target/ (and dbt_packages/) into the project — i.e. NOT read-only.
//
// The command runner is injectable so the orchestration is testable without a
// real dbt binary, and so a missing dbt / failed warehouse step degrades to the
// static yml/manifest fallback instead of crashing.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DBT_BIN = process.env.DBT_ERD_DBT_BIN || 'dbt';

// Run a dbt subcommand, streaming its output. Returns a small result object;
// `missing` is true when the dbt binary itself isn't on PATH (ENOENT).
export function defaultRunner(args, { cwd } = {}) {
	const res = spawnSync(DBT_BIN, args, { cwd, stdio: 'inherit' });
	if (res.error) {
		return { ok: false, missing: res.error.code === 'ENOENT', status: null };
	}
	return { ok: res.status === 0, missing: false, status: res.status };
}

// Ensure target/manifest.json + target/catalog.json exist by running dbt.
// Returns { status, built }, where status is one of:
//   'present'     artifacts already there, nothing run
//   'full'        ran docs generate; manifest + catalog written (types available)
//   'partial'     manifest written but catalog missing (warehouse step failed)
//   'failed'      ran dbt but no artifacts produced
//   'dbt-missing' dbt not installed / not on PATH
export function ensureDbtArtifacts(projectDir, { run = defaultRunner, log = () => { }, force = false } = {}) {
	const target = path.join(projectDir, 'target');
	const manifest = path.join(target, 'manifest.json');
	const catalog = path.join(target, 'catalog.json');

	if (!force && existsSync(manifest) && existsSync(catalog)) {
		return { status: 'present', built: false };
	}

	log('Running dbt to capture warehouse column types (dbt docs generate)…');

	const hasPackages = existsSync(path.join(projectDir, 'packages.yml')) || existsSync(path.join(projectDir, 'dependencies.yml'));
	const depsInstalled = existsSync(path.join(projectDir, 'dbt_packages'));
	if (hasPackages && !depsInstalled) {
		const deps = run(['deps'], { cwd: projectDir });
		if (deps.missing) return missing(log);
		if (!deps.ok) log('`dbt deps` did not complete cleanly; continuing.');
	}

	const gen = run(['docs', 'generate'], { cwd: projectDir });
	if (gen.missing) return missing(log);

	const haveManifest = existsSync(manifest);
	const haveCatalog = existsSync(catalog);
	if (gen.ok && haveCatalog) {
		log('Built dbt artifacts with warehouse column types.');
		return { status: 'full', built: true };
	}
	if (haveManifest) {
		log('Built the dbt manifest, but the warehouse catalog step did not finish — column types may be unavailable (check your dbt profile/credentials).');
		return { status: 'partial', built: true };
	}
	log('dbt did not produce artifacts; falling back to static parsing.');
	return { status: 'failed', built: false };
}

function missing(log) {
	log('dbt is not installed or not on PATH — skipping build. Install dbt and your warehouse adapter to capture column types.');
	return { status: 'dbt-missing', built: false };
}
