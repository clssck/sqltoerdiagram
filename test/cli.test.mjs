import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs } from '../cli/args.js';
import { countTypedColumns, injectModel } from '../cli/generate.js';
import { buildDbtSearchQueries, cloneArgs, validateBranch } from '../cli/github.js';
import { buildModeChoices } from '../cli/index.js';

test('parseArgs maps value and boolean flags', () => {
	assert.deepEqual(parseArgs([
		'--path',
		'./warehouse',
		'--branch',
		'release/v2',
		'--all',
		'--lineage',
		'--out',
		'diagram.html',
		'--open',
		'--keep'
	]), {
		path: './warehouse',
		repo: null,
		branch: 'release/v2',
		all: true,
		lineage: true,
		out: 'diagram.html',
		open: true,
		keep: true,
		help: false,
		build: false
	});
});

test('parseArgs maps repo and help aliases', () => {
	assert.deepEqual(parseArgs(['--repo=owner/name', '-h']), {
		path: null,
		repo: 'owner/name',
		branch: null,
		all: false,
		lineage: false,
		out: null,
		open: false,
		keep: false,
		help: true,
		build: false
	});
	assert.equal(parseArgs(['--help']).help, true);
});

test('parseArgs rejects invalid shapes', () => {
	assert.throws(() => parseArgs(['--path']), /requires a value/);
	assert.throws(() => parseArgs(['--path', 'x', '--repo', 'owner/name']), /either --path or --repo/);
	assert.throws(() => parseArgs(['--bogus']), /Unknown option/);
	assert.throws(() => parseArgs(['extra']), /Unexpected argument/);
});

test('injectModel replaces one erd-model marker with escaped JSON', () => {
	const template = '<!doctype html><html><body><script type="application/json" id="erd-model">{}</script></body></html>';
	const payload = {
		model: {
			tables: [{ name: '</script><img src=x>', columns: [] }],
			relations: [],
			errors: ['x < y']
		},
		meta: { title: 'demo<script>', stats: { tables: 1, relations: 0, columns: 0 } }
	};

	const html = injectModel(template, payload);
	assert.equal((html.match(/id="erd-model"/g) || []).length, 1);
	const match = html.match(/<script type="application\/json" id="erd-model">([\s\S]*?)<\/script>/);
	assert.ok(match);
	assert.doesNotMatch(match[1], /</);
	assert.match(match[1], /\\u003c\/script>/);
	assert.deepEqual(JSON.parse(match[1]), payload);
});

test('countTypedColumns counts non-empty column types', () => {
	assert.equal(countTypedColumns({
		tables: [{
			name: 'orders',
			columns: [
				{ name: 'id', type: 'integer' },
				{ name: 'amount', type: ' numeric ' },
				{ name: 'notes', type: '' }
			]
		}]
	}), 2);

	assert.equal(countTypedColumns({
		tables: [{
			name: 'orders',
			columns: [
				{ name: 'id', type: '' },
				{ name: 'amount', type: '   ' }
			]
		}]
	}), 0);
});

test('buildDbtSearchQueries scopes by owner type and chunks', () => {
	assert.deepEqual(
		buildDbtSearchQueries([{ login: 'me', type: 'User' }, { login: 'AcmeOrg', type: 'Organization' }]),
		['filename:dbt_project.yml user:me org:AcmeOrg']
	);
	const many = Array.from({ length: 12 }, (_, i) => ({ login: `o${i}`, type: 'User' }));
	const chunks = buildDbtSearchQueries(many, 5);
	assert.equal(chunks.length, 3);
	assert.ok(chunks.every((q) => q.startsWith('filename:dbt_project.yml ')));
	assert.equal(buildDbtSearchQueries([]).length, 0);
});

test('cloneArgs appends --branch only when given', () => {
	assert.deepEqual(cloneArgs('o/r', '/tmp/x'), ['repo', 'clone', 'o/r', '/tmp/x', '--', '--depth', '1']);
	assert.deepEqual(cloneArgs('o/r', '/tmp/x', 'dev'), ['repo', 'clone', 'o/r', '/tmp/x', '--', '--depth', '1', '--branch', 'dev']);
});

test('validateBranch accepts refs and rejects unsafe names', () => {
	assert.equal(validateBranch('feature/x-1'), 'feature/x-1');
	assert.throws(() => validateBranch('-rf'), /Invalid branch/);
	assert.throws(() => validateBranch(''), /Invalid branch/);
	assert.throws(() => validateBranch('a b'), /Invalid branch/);
});

test('buildModeChoices keeps only useful modes', () => {
	const mk = (tables, relations) => ({ stats: { tables, relations } });
	let choices = buildModeChoices(mk(75, 0), mk(75, 12));
	assert.equal(choices.length, 1);
	assert.equal(choices[0].lineage, true);

	choices = buildModeChoices(mk(8, 9), mk(8, 4));
	assert.equal(choices.length, 2);
	assert.equal(choices[0].lineage, false);

	choices = buildModeChoices(mk(3, 0), mk(3, 0));
	assert.equal(choices.length, 1);
	assert.equal(choices[0].lineage, false);
	assert.match(choices[0].desc, /tables only/);
});
