#!/usr/bin/env bun
import { rm, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parseArgs, USAGE } from './args.js';
import { generate } from './generate.js';
import {
	cloneRepo,
	commandErrorMessage,
	detectAccount,
	findDbtRepoNames,
	isMissingCommand,
	listBranches,
	listRepos,
	localBranch,
	validateBranch,
	validateRepoName
} from './github.js';
import { chooseFromList, formatRepo } from './prompt.js';
import { selectInteractive } from './browse_tui.js';
import * as dbtMapper from '../src/dbt/index.js';

function sortPaths(paths) {
	return [...paths].map(value => path.resolve(value)).sort((a, b) => a.localeCompare(b));
}

function formatProject(projectDir) {
	const relative = path.relative(process.cwd(), projectDir);
	return relative && !relative.startsWith('..') ? relative : projectDir;
}

// Pick one item from a list. Uses the OpenTUI browser on an interactive TTY
// (bun-native), and falls back to the readline menu otherwise — or if the TUI
// fails to initialize (e.g. raw-mode unavailable in the current environment).
async function chooseFrom(items, { message, formatItem, describe, subtitle } = {}) {
	if (!Array.isArray(items) || items.length === 0) {
		throw new Error('No choices available.');
	}
	if (items.length === 1) {
		return items[0];
	}
	const fmt = formatItem || ((item) => String(item));
	const desc = typeof describe === 'function' ? describe : () => '';
	if (process.stdin.isTTY && process.stdout.isTTY) {
		try {
			const value = await selectInteractive({
				title: message || 'Choose:',
				subtitle,
				items: items.map((item) => ({ name: fmt(item), description: desc(item), value: item }))
			});
			if (value === null) {
				console.error('Cancelled.');
				process.exit(130);
			}
			return value;
		} catch {
			// OpenTUI/raw-mode unavailable -> fall back to the readline menu
		}
	}
	return chooseFromList(items, {
		message,
		formatItem: (item) => {
			const extra = desc(item);
			return extra ? `${fmt(item)} — ${extra}` : fmt(item);
		}
	});
}

async function chooseDbtProject(projects) {
	const choices = sortPaths(projects);
	if (choices.length === 0) {
		throw new Error('No dbt_project.yml found.');
	}
	return chooseFrom(choices, {
		message: 'Choose a dbt project:',
		formatItem: formatProject,
		subtitle: `${choices.length} dbt projects`
	});
}

async function accountForGitHubMode({ requireLogin }) {
	const account = await detectAccount();
	if (account.ghMissing) {
		console.error('GitHub CLI `gh` was not found. Install it and authenticate, or use --path <dir> for a local dbt project.');
	}

	const suffix = account.source === 'git' ? ' (from git config; not a verified GitHub login)' : '';
	console.log(`GitHub account: ${account.login || 'unknown'}${suffix}`);

	if (account.ghMissing) {
		throw new Error('GitHub CLI is required for GitHub repository modes. Use --path <dir> to skip GitHub.');
	}
	if (requireLogin && account.source !== 'gh') {
		throw new Error('Could not determine your GitHub login from `gh` (run `gh auth login`). Browse mode lists repos by your GitHub login — use --repo <owner/name> or --path <dir> to skip browsing.');
	}

	return account.login;
}

function cloneDirName(nameWithOwner) {
	return nameWithOwner.replace(/[\\/\0]/g, '-');
}

function isInside(childPath, parentPath) {
	const relative = path.relative(parentPath, childPath);
	return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

// Resolve which branch to clone: an explicit --branch wins; otherwise, on an
// interactive TTY with multiple branches, prompt (default branch first); else
// undefined, which clones the repo's default branch.
async function resolveBranch(nameWithOwner, opts) {
	if (opts.branch) return validateBranch(opts.branch);
	if (!(process.stdin.isTTY && process.stdout.isTTY)) return undefined;
	let info;
	try {
		info = await listBranches(nameWithOwner);
	} catch {
		return undefined;
	}
	const def = info.default;
	if (info.names.length <= 1) return info.names[0] || undefined;
	const ordered = [def, ...info.names.filter((name) => name !== def)].filter(Boolean);
	return chooseFrom(ordered, {
		message: `Branch for ${nameWithOwner}:`,
		formatItem: (name) => (name === def ? `${name}  (default)` : name)
	});
}

// Build the generate-mode choices, keeping only modes that produce something:
// drop a 0-relation ERD when lineage has edges (and vice-versa). When neither has
// edges, keep the FK ERD as a tables-only layout. Ordered richer-first.
export function buildModeChoices(erd, lineage) {
	const erdChoice = { lineage: false, mapped: erd, label: 'ERD — foreign-key relationships', desc: `${erd.stats.tables} tables · ${erd.stats.relations} FK relations` };
	const lineageChoice = { lineage: true, mapped: lineage, label: 'Lineage — model dependency graph', desc: `${lineage.stats.tables} tables · ${lineage.stats.relations} ref/source edges` };
	const choices = [];
	if (erd.stats.relations > 0) choices.push(erdChoice);
	if (lineage.stats.relations > 0) choices.push(lineageChoice);
	if (choices.length === 0) {
		choices.push({ ...erdChoice, desc: `${erd.stats.tables} tables · no relationships (tables only)` });
	}
	return choices.sort((a, b) => b.mapped.stats.relations - a.mapped.stats.relations);
}

// Decide whether to render the FK ERD or the lineage DAG. --lineage forces
// lineage; a non-TTY run defaults to ERD (deterministic for headless/CI);
// otherwise offer only the modes that produce output, auto-selecting when just
// one is useful (so an empty ERD means you "just see lineage").
async function chooseMode(projectDir, opts, mapDbtProject) {
	if (opts.lineage) {
		return { lineage: true, mapped: await mapDbtProject(projectDir, { lineage: true }) };
	}
	const erd = await mapDbtProject(projectDir, { lineage: false });
	if (!(process.stdin.isTTY && process.stdout.isTTY)) {
		return { lineage: false, mapped: erd };
	}
	const lineage = await mapDbtProject(projectDir, { lineage: true });
	const choices = buildModeChoices(erd, lineage);
	if (choices.length === 1) {
		const only = choices[0];
		console.log(`Generating ${only.label} (${only.desc}).`);
		return { lineage: only.lineage, mapped: only.mapped };
	}
	const chosen = await chooseFrom(choices, {
		message: `What to generate for ${erd.project}?`,
		formatItem: (choice) => choice.label,
		describe: (choice) => choice.desc
	});
	return { lineage: chosen.lineage, mapped: chosen.mapped };
}

async function cloneGenerate(nameWithOwner, opts, mapper, account) {
	validateRepoName(nameWithOwner);
	const branch = await resolveBranch(nameWithOwner, opts);
	const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'dbt-erd-'));
	const repoDir = path.join(tmpRoot, cloneDirName(nameWithOwner));

	let outFile = null;
	try {
		await cloneRepo(nameWithOwner, repoDir, branch);
		const effectiveBranch = branch || await localBranch(repoDir);
		const projects = mapper.findDbtProjects(repoDir);
		if (projects.length === 0) {
			throw new Error(`No dbt_project.yml found in ${nameWithOwner}${branch ? ` (branch ${branch})` : ''}.`);
		}
		const projectDir = await chooseDbtProject(projects);
		const mode = await chooseMode(projectDir, opts, mapper.mapDbtProject);
		outFile = await generate(projectDir, {
			lineage: mode.lineage,
			mapped: mode.mapped,
			out: opts.out,
			open: opts.open,
			account,
			repo: nameWithOwner,
			branch: effectiveBranch,
			mapDbtProject: mapper.mapDbtProject
		});
		return outFile;
	} finally {
		const outputInsideTmp = outFile && isInside(outFile, tmpRoot);
		if (opts.keep || outputInsideTmp) {
			console.log(`Kept clone: ${tmpRoot}`);
		} else {
			await rm(tmpRoot, { recursive: true, force: true });
		}
	}
}

async function runWithPath(opts, mapper) {
	const root = path.resolve(opts.path);
	const projects = mapper.findDbtProjects(root);
	if (projects.length === 0) {
		throw new Error(`No dbt_project.yml found under ${root}.`);
	}
	const projectDir = await chooseDbtProject(projects);
	// --path is read-only: never checkout; just record the current branch (if any).
	const branch = await localBranch(projectDir);
	const mode = await chooseMode(projectDir, opts, mapper.mapDbtProject);
	return generate(projectDir, {
		lineage: mode.lineage,
		mapped: mode.mapped,
		out: opts.out,
		open: opts.open,
		account: null,
		repo: null,
		branch,
		mapDbtProject: mapper.mapDbtProject
	});
}

async function runWithRepo(opts, mapper) {
	const repo = validateRepoName(opts.repo);
	const account = await accountForGitHubMode({ requireLogin: false });
	return cloneGenerate(repo, opts, mapper, account);
}

async function runBrowse(opts, mapper) {
	const account = await accountForGitHubMode({ requireLogin: true });
	const repos = await listRepos();
	if (repos.length === 0) {
		throw new Error('No accessible repositories found.');
	}

	let choices = repos;
	let dbtOnly = false;
	if (!opts.all) {
		const dbtNames = await findDbtRepoNames(repos);
		choices = repos.filter((repo) => dbtNames.has(repo.nameWithOwner));
		dbtOnly = true;
		if (choices.length === 0) {
			throw new Error(`No dbt repositories found via code search across ${repos.length} accessible repos. Re-run with --all to browse everything, or use --repo <owner/name> / --path <dir>.`);
		}
	}

	const selected = await chooseFrom(choices, {
		message: dbtOnly ? 'Choose a dbt repository:' : 'Choose a repository:',
		formatItem: formatRepo,
		describe: (repo) => [repo.primaryLanguage?.name, repo.description].filter(Boolean).join(' · '),
		subtitle: dbtOnly ? `${choices.length} repositories with dbt` : `${choices.length} repositories (all)`
	});
	return cloneGenerate(selected.nameWithOwner, opts, mapper, account);
}

export async function main(argv = process.argv.slice(2)) {
	let opts;
	try {
		opts = parseArgs(argv);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		console.error(USAGE);
		return 1;
	}

	if (opts.help) {
		console.log(USAGE);
		return 0;
	}

	const mapper = dbtMapper;
	if (typeof mapper.findDbtProjects !== 'function' || typeof mapper.mapDbtProject !== 'function') {
		throw new Error('src/dbt/index.js must export findDbtProjects and mapDbtProject.');
	}

	if (opts.path) {
		await runWithPath(opts, mapper);
	} else if (opts.repo) {
		await runWithRepo(opts, mapper);
	} else {
		await runBrowse(opts, mapper);
	}
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().then(code => {
		process.exitCode = code;
	}).catch(error => {
		if (isMissingCommand(error)) {
			console.error('Required command was not found. Install GitHub CLI `gh`, or use --path <dir> for a local dbt project.');
		} else {
			console.error(`Error: ${commandErrorMessage(error)}`);
		}
		process.exitCode = 1;
	});
}
