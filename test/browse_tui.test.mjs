import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createTestRenderer } from '@opentui/core/testing';
import { SelectRenderableEvents } from '@opentui/core';
import { buildSelectScreen, fuzzyFilter, fuzzyScore } from '../cli/browse_tui.js';

const items = [
	{ name: 'acme/orders-api', description: 'TypeScript · order service', value: 'acme/orders-api' },
	{ name: '[dbt] acme/warehouse', description: 'Python · dbt models', value: 'acme/warehouse' },
	{ name: 'acme/marketing-site', description: 'JavaScript', value: 'acme/marketing-site' },
];

describe('fuzzy filter', () => {
	test('empty keeps all; substring matches; non-matches dropped', () => {
		assert.equal(fuzzyFilter(items, '').length, 3);
		assert.deepEqual(fuzzyFilter(items, 'ware').map((i) => i.value), ['acme/warehouse']);
		assert.ok(fuzzyScore('python', 'Python · dbt models') > 0);
		assert.equal(fuzzyScore('zzz', 'acme/orders'), -1);
	});
});

describe('OpenTUI browse screen', () => {
	test('renders title, subtitle, filter line, options and a rounded frame', async () => {
		const t = await createTestRenderer({ width: 80, height: 22 });
		try {
			buildSelectScreen(t.renderer, { title: 'Choose a repository', subtitle: '3 repositories · 1 with dbt', items });
			await t.renderOnce();
			const frame = t.captureCharFrame();
			assert.match(frame, /Choose a repository/);
			assert.match(frame, /3 repositories · 1 with dbt/);
			assert.match(frame, /Filter:/);
			assert.match(frame, /acme\/orders-api/);
			assert.match(frame, /\[dbt\] acme\/warehouse/);
			assert.ok(frame.includes('╭') && frame.includes('╰'), 'rounded border is drawn');
		} finally {
			t.renderer.destroy?.();
		}
	});

	test('typing filters the list to fuzzy matches', async () => {
		const t = await createTestRenderer({ width: 80, height: 22 });
		try {
			const screen = buildSelectScreen(t.renderer, { title: 'Pick', items });
			await t.renderOnce();
			await t.mockInput.typeText('ware');
			await t.flush();
			assert.deepEqual(screen.getVisible().map((i) => i.value), ['acme/warehouse']);
			const frame = t.captureCharFrame();
			assert.match(frame, /\[dbt\] acme\/warehouse/);
			assert.doesNotMatch(frame, /orders-api/);
		} finally {
			t.renderer.destroy?.();
		}
	});

	test('arrow-down + Enter selects the focused item', async () => {
		const t = await createTestRenderer({ width: 80, height: 22 });
		try {
			const { select } = buildSelectScreen(t.renderer, { title: 'Pick', items });
			const picked = new Promise((resolve) => {
				select.on(SelectRenderableEvents.ITEM_SELECTED, () => resolve(select.getSelectedOption()?.value));
			});
			await t.renderOnce();
			t.mockInput.pressArrow('down');
			await t.flush();
			t.mockInput.pressEnter();
			await t.flush();
			const value = await Promise.race([
				picked,
				new Promise((_, reject) => setTimeout(() => reject(new Error('no ITEM_SELECTED')), 2000)),
			]);
			assert.equal(value, 'acme/warehouse');
		} finally {
			t.renderer.destroy?.();
		}
	});

	test('type-to-filter then Enter selects the single match', async () => {
		const t = await createTestRenderer({ width: 80, height: 22 });
		try {
			const { select } = buildSelectScreen(t.renderer, { title: 'Pick', items });
			const picked = new Promise((resolve) => {
				select.on(SelectRenderableEvents.ITEM_SELECTED, () => resolve(select.getSelectedOption()?.value));
			});
			await t.renderOnce();
			await t.mockInput.typeText('market');
			await t.flush();
			t.mockInput.pressEnter();
			await t.flush();
			const value = await Promise.race([
				picked,
				new Promise((_, reject) => setTimeout(() => reject(new Error('no ITEM_SELECTED')), 2000)),
			]);
			assert.equal(value, 'acme/marketing-site');
		} finally {
			t.renderer.destroy?.();
		}
	});
});
