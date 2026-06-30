import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const MAX_BUFFER = 20 * 1024 * 1024;
const REPO_NAME_RE = /^[\w.-]+\/[\w.-]+$/;

export function validateRepoName(name) {
	if (typeof name !== 'string' || !REPO_NAME_RE.test(name)) {
		throw new Error(`Invalid repository name: ${name || '(empty)'}. Expected owner/name.`);
	}
	return name;
}

export function isMissingCommand(error) {
	return error?.code === 'ENOENT';
}

export function commandErrorMessage(error) {
	return String(error?.stderr || error?.stdout || error?.message || 'Command failed').trim();
}

export async function runCommand(command, args, options = {}) {
	return execFile(command, args, {
		encoding: 'utf8',
		maxBuffer: MAX_BUFFER,
		...options
	});
}

export async function detectAccount() {
	let ghMissing = false;
	let ghError = null;

	try {
		const { stdout } = await runCommand('gh', ['api', 'user', '--jq', '.login']);
		const login = stdout.trim();
		if (login) {
			return { login, source: 'gh', ghMissing: false, ghError: null };
		}
	} catch (error) {
		ghMissing = isMissingCommand(error);
		ghError = error;
	}

	try {
		const { stdout } = await runCommand('git', ['config', 'user.name']);
		const login = stdout.trim();
		if (login) {
			return { login, source: 'git', ghMissing, ghError };
		}
	} catch {
		// Leave login unknown; callers decide whether that is fatal for the mode.
	}

	return { login: null, source: null, ghMissing, ghError };
}

export async function listRepos() {
	const { stdout } = await runCommand('gh', [
		'api',
		'--paginate',
		'-X',
		'GET',
		'/user/repos',
		'-f',
		'per_page=100',
		'-f',
		'affiliation=owner,collaborator,organization_member',
		'-f',
		'sort=updated',
		'--jq',
		'.[] | {name: .name, nameWithOwner: .full_name, description: .description, primaryLanguage: (if .language then {name: .language} else null end), updatedAt: .updated_at, isPrivate: .private, owner: .owner.login, ownerType: .owner.type}'
	]);

	const seen = new Set();
	const repos = [];
	for (const line of stdout.split(/\r?\n/)) {
		const text = line.trim();
		if (!text) continue;
		let repo;
		try {
			repo = JSON.parse(text);
		} catch {
			continue;
		}
		if (!repo?.nameWithOwner || seen.has(repo.nameWithOwner)) continue;
		seen.add(repo.nameWithOwner);
		repos.push(repo);
	}
	return repos;
}

const SEARCH_CHUNK = 5;

// Build code-search queries for `filename:dbt_project.yml` scoped to the given
// owners (chunked to keep each query small). `owners` is [{ login, type }] where
// type "Organization" maps to `org:` and anything else to `user:`.
export function buildDbtSearchQueries(owners, chunkSize = SEARCH_CHUNK) {
	const queries = [];
	for (let i = 0; i < owners.length; i += chunkSize) {
		const scopes = owners
			.slice(i, i + chunkSize)
			.map((owner) => `${owner.type === 'Organization' ? 'org' : 'user'}:${owner.login}`)
			.join(' ');
		if (scopes) queries.push(`filename:dbt_project.yml ${scopes}`);
	}
	return queries;
}

// Find which of `repos` contain a dbt_project.yml (anywhere in the tree, incl.
// nested) via GitHub code search scoped to the repos' distinct owners. Returns a
// Set of nameWithOwner. Best-effort: code search can rate-limit, so query
// failures are skipped rather than fatal.
export async function findDbtRepoNames(repos) {
	const owners = [];
	const seenOwner = new Set();
	for (const repo of repos) {
		const login = repo.owner;
		if (!login || seenOwner.has(login)) continue;
		seenOwner.add(login);
		owners.push({ login, type: repo.ownerType });
	}

	const names = new Set();
	for (const query of buildDbtSearchQueries(owners)) {
		try {
			const { stdout } = await runCommand('gh', [
				'api',
				'--paginate',
				'-X',
				'GET',
				'search/code',
				'-f',
				`q=${query}`,
				'--jq',
				'.items[].repository.full_name'
			]);
			for (const line of stdout.split(/\r?\n/)) {
				const text = line.trim();
				if (text) names.add(text);
			}
		} catch {
			// Code search is best-effort (rate limits / indexing); skip on failure.
		}
	}
	return names;
}

const BRANCH_RE = /^[^\s/~^:?*\\[][^\s~^:?*\\[]*$/;

// Validate a user-supplied branch/ref name: reject empty, leading '-', and
// characters git refs disallow. (API branch names are already valid.)
export function validateBranch(branch) {
	const value = String(branch || '').trim();
	if (!value || value.startsWith('-') || !BRANCH_RE.test(value)) {
		throw new Error(`Invalid branch name: ${branch || '(empty)'}`);
	}
	return value;
}

// Build the `gh repo clone` argv (git flags after `--`); `branch` is optional.
export function cloneArgs(nameWithOwner, destination, branch) {
	const args = ['repo', 'clone', nameWithOwner, destination, '--', '--depth', '1'];
	if (branch) args.push('--branch', branch);
	return args;
}

export async function cloneRepo(nameWithOwner, destination, branch) {
	validateRepoName(nameWithOwner);
	if (branch) validateBranch(branch);
	await runCommand('gh', cloneArgs(nameWithOwner, destination, branch));
}

// List a repo's branch names (paginated) plus its default branch.
export async function listBranches(nameWithOwner) {
	validateRepoName(nameWithOwner);
	const { stdout } = await runCommand('gh', [
		'api',
		'--paginate',
		`repos/${nameWithOwner}/branches`,
		'--jq',
		'.[].name'
	]);
	const names = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	let def = '';
	try {
		const defOut = await runCommand('gh', ['api', `repos/${nameWithOwner}`, '--jq', '.default_branch']);
		def = defOut.stdout.trim();
	} catch {
		// default branch is best-effort
	}
	return { names, default: def };
}

// Current branch of a local git checkout, or null when `dir` isn't a git repo.
export async function localBranch(dir) {
	try {
		const { stdout } = await runCommand('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD']);
		const name = stdout.trim();
		return name && name !== 'HEAD' ? name : null;
	} catch {
		return null;
	}
}

export function openFile(filePath) {
	let command;
	let args;

	if (process.platform === 'darwin') {
		command = 'open';
		args = [filePath];
	} else if (process.platform === 'win32') {
		command = 'cmd.exe';
		args = ['/c', 'start', '', filePath];
	} else {
		command = 'xdg-open';
		args = [filePath];
	}

	try {
		const child = spawn(command, args, { detached: true, stdio: 'ignore' });
		child.on('error', () => { });
		child.unref();
		return true;
	} catch {
		return false;
	}
}
