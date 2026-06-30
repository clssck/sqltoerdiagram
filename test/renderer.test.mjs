import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	COLLAPSE_THRESHOLD,
	isCollapsible,
	visibleColumns,
	tableFooter,
	groupColor,
	columnY,
	ROW_H,
	HEADER_H,
} from '../src/renderer.js';

function makeTable(nCols, { collapsed, group } = {}) {
	const columns = Array.from({ length: nCols }, (_, i) => ({
		name: `c${i}`,
		type: '',
		pk: false,
		nn: false,
		unique: false,
		fk: false,
	}));
	const t = { name: 't', key: 't', columns };
	if (collapsed !== undefined) t.collapsed = collapsed;
	if (group !== undefined) t.group = group;
	// h is only needed for the no-column-name branch of columnY
	t.h = HEADER_H + nCols * ROW_H;
	return t;
}

describe('collapse visibility', () => {
	test('isCollapsible only above the threshold', () => {
		assert.equal(isCollapsible(makeTable(COLLAPSE_THRESHOLD)), false);
		assert.equal(isCollapsible(makeTable(COLLAPSE_THRESHOLD + 1)), true);
		assert.equal(isCollapsible(makeTable(0)), false);
	});

	test('visibleColumns slices to the head only when collapsed AND collapsible', () => {
		// not collapsed -> all
		assert.equal(visibleColumns(makeTable(12, { collapsed: false })).length, 12);
		// collapsed + collapsible -> head
		assert.equal(visibleColumns(makeTable(12, { collapsed: true })).length, COLLAPSE_THRESHOLD);
		// collapsed but not collapsible (<= threshold) -> all
		assert.equal(visibleColumns(makeTable(5, { collapsed: true })).length, 5);
		// no collapsed flag at all (SQL app) -> all
		assert.equal(visibleColumns(makeTable(20)).length, 20);
	});
});

describe('tableFooter', () => {
	test('null unless collapsed is an explicit boolean and table is collapsible', () => {
		// SQL app: no collapsed flag -> never a footer (renderer untouched)
		assert.equal(tableFooter(makeTable(20)), null);
		// small table: nothing to collapse
		assert.equal(tableFooter(makeTable(5, { collapsed: true })), null);
	});

	test('collapsed footer reports hidden count; expanded footer offers show less', () => {
		const collapsed = tableFooter(makeTable(12, { collapsed: true }));
		assert.deepEqual(collapsed, { collapsed: true, label: `+${12 - COLLAPSE_THRESHOLD} more` });
		const expanded = tableFooter(makeTable(12, { collapsed: false }));
		assert.deepEqual(expanded, { collapsed: false, label: 'show less' });
	});
});

describe('groupColor', () => {
	test('null for empty group, stable hex otherwise', () => {
		assert.equal(groupColor(''), null);
		assert.equal(groupColor(null), null);
		assert.equal(groupColor(undefined), null);
		const a = groupColor('staging');
		assert.match(a, /^#[0-9a-f]{6}$/i);
		assert.equal(groupColor('staging'), a); // deterministic
		// different groups generally differ (these two are known-distinct in the palette)
		assert.notEqual(groupColor('staging'), groupColor('marts'));
	});
});

describe('columnY with collapse', () => {
	test('visible column -> its row; hidden column -> footer row; unknown -> header', () => {
		const t = makeTable(12, { collapsed: true }); // 8 visible + footer
		// first visible column
		assert.equal(columnY(t, 'c0'), HEADER_H + 0 * ROW_H + ROW_H / 2);
		// a hidden column (index 9) anchors to the footer row at cols.length (8)
		assert.equal(columnY(t, 'c9'), HEADER_H + COLLAPSE_THRESHOLD * ROW_H + ROW_H / 2);
		// unknown column -> header centre
		assert.equal(columnY(t, 'nope'), HEADER_H / 2);
		// no column name -> table centre
		assert.equal(columnY(t, ''), t.h / 2);
	});

	test('expanded table anchors every column at its true row', () => {
		const t = makeTable(12, { collapsed: false });
		assert.equal(columnY(t, 'c9'), HEADER_H + 9 * ROW_H + ROW_H / 2);
	});
});
