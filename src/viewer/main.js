import { Diagram } from '../diagram.js';
import { layout } from '../layout.js';
import { isCollapsible, groupColor } from '../renderer.js';
import { availableGroupModes, applyGroupMode } from '../grouping.js';

const THEME_KEY = 'dbt-erd-theme';
const MIN_SCALE = 0.08;
const MAX_SCALE = 4;

const canvas = document.getElementById('erd');
const emptyState = document.getElementById('empty-state');
const modelScript = document.getElementById('erd-model');
const titleChip = document.getElementById('title-chip');
const metaLine = document.getElementById('meta-line');
const themeToggle = document.getElementById('theme-toggle');
const fitButton = document.getElementById('fit');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const expandAll = document.getElementById('expand-all');
const collapseAll = document.getElementById('collapse-all');
const legend = document.getElementById('legend');
const typeHint = document.getElementById('type-hint');
const groupBy = document.getElementById('group-by');

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function readTheme() {
	try {
		const saved = localStorage.getItem(THEME_KEY);
		return saved === 'light' || saved === 'dark' ? saved : null;
	} catch {
		return null;
	}
}

function saveTheme(theme) {
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		// Ignore unavailable storage; the viewer still works for this session.
	}
}

function parsePayload() {
	try {
		return JSON.parse(modelScript?.textContent || '{}');
	} catch {
		return {};
	}
}

function showEmpty() {
	emptyState.hidden = false;
	titleChip.textContent = 'dbt ERD';
	metaLine.textContent = 'No diagram data';
}

function statsFor(model, meta = {}) {
	const stats = meta.stats || {};
	const tables = stats.tables ?? model.tables.length;
	const relations = stats.relations ?? (model.relations || []).length;
	const columns = stats.columns ?? model.tables.reduce((sum, table) => sum + (table.columns || []).length, 0);
	return { tables, relations, columns };
}

function populateMeta(model, meta = {}) {
	const stats = statsFor(model, meta);
	const title = meta.title || meta.project || 'dbt ERD';
	const statsText = `${stats.tables} tables / ${stats.relations} relations`;
	const parts = [meta.project, meta.mode, meta.source, meta.branch, statsText].filter(Boolean);
	titleChip.textContent = title;
	metaLine.textContent = parts.join(' · ');
}

function populateLegend(model) {
	const groups = [...new Set(model.tables.map((table) => table.group).filter(Boolean))].sort();
	legend.replaceChildren();

	for (const group of groups) {
		const item = document.createElement('span');
		item.className = 'legend-item';

		const swatch = document.createElement('span');
		swatch.className = 'swatch';
		swatch.style.backgroundColor = groupColor(group);

		const label = document.createElement('span');
		label.textContent = group;

		item.append(swatch, label);
		legend.append(item);
	}
}

function maybeShowTypeHint(model, meta = {}) {
	const { columns } = statsFor(model, meta);

	if (meta.columnsTyped === 0 && columns > 0) {
		typeHint.textContent = 'Column types unavailable — this diagram was built from dbt yml without a catalog. Re-run dbt-erd with --build to run `dbt docs generate` and embed real warehouse column types.';
		const dismiss = document.createElement('button');
		dismiss.type = 'button';
		dismiss.className = 'type-hint-dismiss';
		dismiss.setAttribute('aria-label', 'Dismiss');
		dismiss.textContent = '×';
		dismiss.addEventListener('click', () => { typeHint.hidden = true; });
		typeHint.appendChild(dismiss);
		typeHint.hidden = false;
	}
}

function syncThemeButton(diagram) {
	const theme = diagram.themeName === 'light' ? 'light' : 'dark';
	themeToggle.textContent = theme;
	themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
	themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
}

const payload = parsePayload();

if (!payload?.model || !Array.isArray(payload.model.tables) || payload.model.tables.length === 0) {
	showEmpty();
} else {
	const model = payload.model;
	for (const t of model.tables) t.collapsed = true;
	applyGroupMode(model.tables, 'none');   // default flat; any stale payload group is cleared
	layout(model, { dir: 'LR', spacing: 'comfortable' });
	populateMeta(model, payload.meta || {});
	populateLegend(model);
	maybeShowTypeHint(model, payload.meta || {});

	const d = new Diagram(canvas);
	d.editable = false;
	d.connectable = false;
	d.setModel(model);
	d.setTheme(readTheme() || 'dark');
	d.start();
	d.fit();
	d.onRelayout = () => {
		layout(model, { dir: 'LR', spacing: 'comfortable' }, d.hidden);
		d.fit();
	};

	if (!model.tables.some(isCollapsible)) {
		expandAll.hidden = true;
		collapseAll.hidden = true;
	}

	expandAll.addEventListener('click', () => {
		d.setAllCollapsed(false);
	});

	collapseAll.addEventListener('click', () => {
		d.setAllCollapsed(true);
	});

	const groupModes = availableGroupModes(model.tables);
	const groupByWrap = groupBy.closest('.group-by');
	if (groupModes.length === 0) {
		if (groupByWrap) groupByWrap.hidden = true;
	} else {
		for (const m of [{ key: 'none', label: 'None' }, ...groupModes]) {
			const opt = document.createElement('option');
			opt.value = m.key;
			opt.textContent = m.count ? `${m.label} (${m.count})` : m.label;
			groupBy.append(opt);
		}
		groupBy.value = 'none';
		groupBy.addEventListener('change', () => {
			applyGroupMode(model.tables, groupBy.value);
			layout(model, { dir: 'LR', spacing: 'comfortable' }, d.hidden);
			d.invalidateBitmaps();
			populateLegend(model);
			d.fit();
		});
	}
	syncThemeButton(d);

	themeToggle.addEventListener('click', () => {
		const next = d.themeName === 'dark' ? 'light' : 'dark';
		d.setTheme(next);
		saveTheme(next);
		syncThemeButton(d);
	});

	fitButton.addEventListener('click', () => {
		d.fit();
	});

	zoomIn.addEventListener('click', () => {
		d.setCamera({ ...d.cam, scale: clamp(d.cam.scale * 1.25, MIN_SCALE, MAX_SCALE) });
		d.markDirty();
	});

	zoomOut.addEventListener('click', () => {
		d.setCamera({ ...d.cam, scale: clamp(d.cam.scale * 0.8, MIN_SCALE, MAX_SCALE) });
		d.markDirty();
	});

	window.addEventListener('resize', () => {
		d.resize();
	});
}
