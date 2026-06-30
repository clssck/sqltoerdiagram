import { Diagram } from '../diagram.js';
import { layout } from '../layout.js';

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
	layout(model, { dir: 'LR', spacing: 'comfortable' });
	populateMeta(model, payload.meta || {});

	const d = new Diagram(canvas);
	d.editable = false;
	d.connectable = false;
	d.setModel(model);
	d.setTheme(readTheme() || 'dark');
	d.start();
	d.fit();
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
