import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { availableGroupModes, modeHasSignal, applyGroupMode, groupValue } from '../src/grouping.js';

function table(groups) {
	return { groups, group: '' };
}

function tablesWith(key, values) {
	return values.map((value) => table({ [key]: value }));
}

describe('grouping signal detection', () => {
	test('detects useful grouping signal and rejects noisy dimensions', () => {
		assert.equal(modeHasSignal(tablesWith('domain', ['finance', 'finance', 'sales', 'sales']), 'domain'), true);

		const dominant = [
			...Array.from({ length: 91 }, () => 'catch_all'),
			...Array.from({ length: 2 }, () => 'small_cluster'),
			...Array.from({ length: 7 }, () => ''),
		];
		assert.equal(modeHasSignal(tablesWith('domain', dominant), 'domain'), false);

		assert.equal(modeHasSignal(tablesWith('domain', ['a', 'b', 'c', 'd']), 'domain'), false);
		assert.equal(modeHasSignal(tablesWith('domain', ['finance', 'finance', 'sales', 'sales', '', '', '', '', '', '']), 'domain'), false);
	});

	test('returns available modes with signal in configured order', () => {
		const tables = [
			table({ domain: 'finance', layer: 'staging', folder: 'marts/core', schema: 'public' }),
			table({ domain: 'finance', layer: 'staging', folder: 'marts/core', schema: 'public' }),
			table({ domain: 'sales', layer: 'marts', folder: 'staging/stripe', schema: 'public' }),
			table({ domain: 'sales', layer: 'marts', folder: 'staging/stripe', schema: 'public' }),
			table({ domain: 'ops', layer: 'source', folder: 'source/stripe', schema: 'public' }),
			table({ domain: 'ops', layer: 'source', folder: 'source/stripe', schema: 'analytics' }),
		];

		const modes = availableGroupModes(tables);
		assert.deepEqual(modes.map((mode) => mode.key), ['domain', 'layer', 'folder']);
		assert.deepEqual(modes.map((mode) => typeof mode.count), ['number', 'number', 'number']);
		assert.deepEqual(modes.map((mode) => mode.count), [3, 3, 3]);
	});
});

describe('group application', () => {
	test('applies only multi-member values and clears groups for none', () => {
		const tables = [
			table({ domain: 'finance' }),
			table({ domain: 'finance' }),
			table({ domain: 'sales' }),
			table({ domain: 'sales' }),
			table({ domain: 'ops' }),
			table({ domain: '' }),
		];

		applyGroupMode(tables, 'domain');
		assert.deepEqual(tables.map((candidate) => candidate.group), ['finance', 'finance', 'sales', 'sales', '', '']);

		applyGroupMode(tables, 'none');
		assert.deepEqual(tables.map((candidate) => candidate.group), ['', '', '', '', '', '']);
	});

	test('reads blank group values for missing or non-string keys', () => {
		assert.equal(groupValue(table({ domain: 'finance' }), 'domain'), 'finance');
		assert.equal(groupValue(table({}), 'domain'), '');
		assert.equal(groupValue(table({ domain: null }), 'domain'), '');
		assert.equal(groupValue({}, 'domain'), '');
	});
});
