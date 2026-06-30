import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openFile } from './github.js';

const MODEL_SCRIPT_RE = /(<script type="application\/json" id="erd-model">)[\s\S]*?(<\/script>)/;
const MODEL_TAG_RE = /<script type="application\/json" id="erd-model">/g;
const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(CLI_DIR, '..');
const TEMPLATE_PATH = path.join(PACKAGE_ROOT, 'dist', 'viewer', 'viewer.html');
const BUILD_RUNNER = 'bun';

function defaultOutFile(project) {
	const stem = String(project || 'dbt_project')
		.replace(/[\\/\0]/g, '-')
		.replace(/^\.+$/, 'dbt_project') || 'dbt_project';
	return path.resolve(process.cwd(), `${stem}.erd.html`);
}

async function readViewerTemplate() {
	if (!existsSync(TEMPLATE_PATH)) {
		execFileSync(BUILD_RUNNER, ['run', 'build:viewer'], {
			cwd: PACKAGE_ROOT,
			stdio: 'inherit'
		});
	}

	if (!existsSync(TEMPLATE_PATH)) {
		throw new Error('Viewer template not found at dist/viewer/viewer.html. Run `bun run build:viewer` and try again.');
	}

	return readFile(TEMPLATE_PATH, 'utf8');
}

export function injectModel(template, payload) {
	const matches = template.match(MODEL_TAG_RE) || [];
	if (matches.length !== 1) {
		throw new Error(`Expected exactly one erd-model script tag, found ${matches.length}.`);
	}

	const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
	return template.replace(MODEL_SCRIPT_RE, (_match, open, close) => `${open}${safeJson}${close}`);
}

export async function generate(projectDir, opts = {}) {
	if (typeof opts.mapDbtProject !== 'function') {
		throw new Error('generate requires opts.mapDbtProject');
	}

	const log = opts.log || console.log;
	const r = opts.mapped || await opts.mapDbtProject(projectDir, { lineage: Boolean(opts.lineage) });
	const payload = {
		model: r.model,
		meta: {
			title: r.project + (r.mode === 'lineage' ? ' (lineage)' : ''),
			project: r.project,
			mode: r.mode,
			source: r.source,
			generatedAt: new Date().toISOString(),
			stats: r.stats,
			account: opts.account || null,
			repo: opts.repo || null,
			branch: opts.branch || null
		}
	};
	const outFile = path.resolve(opts.out || defaultOutFile(r.project));
	const template = await readViewerTemplate();
	const html = injectModel(template, payload);

	await mkdir(path.dirname(outFile), { recursive: true });
	await writeFile(outFile, html, 'utf8');

	log(`Wrote ${outFile}`);
	log(`${r.stats.tables} tables, ${r.stats.relations} relations`);
	if (r.stats.relations === 0 && r.mode === 'erd') {
		log('No FK relationships found (no `relationships` tests). Re-run with --lineage for the model dependency graph.');
	}
	if (opts.open && !openFile(outFile)) {
		log(`Could not open ${outFile} automatically.`);
	}

	return outFile;
}
