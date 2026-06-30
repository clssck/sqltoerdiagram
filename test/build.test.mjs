import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDbtArtifacts } from '../src/dbt/build.js';

function withProject(callback) {
	const projectDir = mkdtempSync(path.join(os.tmpdir(), 'dbt-build-test-'));
	try {
		return callback(projectDir);
	} finally {
		rmSync(projectDir, { recursive: true, force: true });
	}
}

function writeArtifact(projectDir, fileName) {
	const target = path.join(projectDir, 'target');
	mkdirSync(target, { recursive: true });
	writeFileSync(path.join(target, fileName), '{}');
}

function silentLog() { }

describe('ensureDbtArtifacts', () => {
	test('returns present without running dbt when manifest and catalog already exist', () => withProject((projectDir) => {
		writeArtifact(projectDir, 'manifest.json');
		writeArtifact(projectDir, 'catalog.json');
		const calls = [];
		const run = (args, options) => {
			calls.push({ args, options });
			return { ok: true };
		};

		const result = ensureDbtArtifacts(projectDir, { run, log: silentLog });

		assert.deepEqual(result, { status: 'present', built: false });
		assert.deepEqual(calls, []);
	}));

	test('reports dbt-missing when docs generate cannot find dbt', () => withProject((projectDir) => {
		const calls = [];
		const run = (args, options) => {
			calls.push({ args, options });
			return { missing: true };
		};

		const result = ensureDbtArtifacts(projectDir, { run, log: silentLog });

		assert.deepEqual(result, { status: 'dbt-missing', built: false });
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0].args, ['docs', 'generate']);
		assert.deepEqual(calls[0].options, { cwd: projectDir });
	}));

	test('reports full when docs generate writes manifest and catalog', () => withProject((projectDir) => {
		const calls = [];
		const run = (args, options) => {
			calls.push({ args, options });
			writeArtifact(projectDir, 'manifest.json');
			writeArtifact(projectDir, 'catalog.json');
			return { ok: true };
		};

		const result = ensureDbtArtifacts(projectDir, { run, log: silentLog });

		assert.deepEqual(result, { status: 'full', built: true });
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0].args, ['docs', 'generate']);
		assert.deepEqual(calls[0].options, { cwd: projectDir });
	}));

	test('reports partial when docs generate writes only manifest and fails', () => withProject((projectDir) => {
		const calls = [];
		const run = (args, options) => {
			calls.push({ args, options });
			writeArtifact(projectDir, 'manifest.json');
			return { ok: false };
		};

		const result = ensureDbtArtifacts(projectDir, { run, log: silentLog });

		assert.deepEqual(result, { status: 'partial', built: true });
		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0].args, ['docs', 'generate']);
		assert.deepEqual(calls[0].options, { cwd: projectDir });
	}));
});
