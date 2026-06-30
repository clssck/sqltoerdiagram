// Interactive selection screen rendered with OpenTUI (@opentui/core).
//
// The CLI is bun-native, so this imports OpenTUI statically and drives a focused
// SelectRenderable for keyboard navigation, with type-to-filter (fuzzy) search.
// `selectInteractive` resolves to the chosen item's `value` (or `null` on cancel).
//
// `buildSelectScreen` is split out so the headless test renderer
// (@opentui/core/testing) can mount + drive the exact same UI without a TTY.
import {
	createCliRenderer,
	BoxRenderable,
	TextRenderable,
	SelectRenderable,
	SelectRenderableEvents,
} from "@opentui/core";

const THEME = {
	bg: "#1a1b26",
	fg: "#c0caf5",
	accent: "#7aa2f7",
	accentText: "#1a1b26",
	dim: "#565f89",
	focusBg: "#283457",
};

const DEFAULT_FOOTER = "type to filter  \u00b7  \u2191/\u2193 move  \u00b7  Enter select  \u00b7  Esc cancel";

// Fuzzy score of `query` against `text`: a substring match ranks highest, then a
// subsequence match (with a contiguity bonus). Returns -1 for no match, 0 for an
// empty query.
export function fuzzyScore(query, text) {
	const q = String(query || "").toLowerCase();
	if (!q) return 0;
	const t = String(text || "").toLowerCase();
	const sub = t.indexOf(q);
	if (sub >= 0) return 1000 - sub;
	let qi = 0;
	let score = 0;
	let last = -2;
	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			score += last === ti - 1 ? 6 : 1;
			last = ti;
			qi++;
		}
	}
	return qi === q.length ? score : -1;
}

// Filter + rank items by a fuzzy query over `${name} ${description}`.
export function fuzzyFilter(items, query) {
	if (!query) return items.slice();
	return items
		.map((item) => ({ item, score: fuzzyScore(query, `${item.name} ${item.description || ""}`) }))
		.filter((entry) => entry.score >= 0)
		.sort((a, b) => b.score - a.score)
		.map((entry) => entry.item);
}

function toOptions(items) {
	return items.map((item) => ({
		name: item.name,
		description: item.description || "",
		value: item.value !== undefined ? item.value : item,
	}));
}

function filterLine(query, count, total) {
	if (!query) return `Filter: (type to search ${total})`;
	return `Filter: ${query}\u2588   ${count}/${total}`;
}

// Mount the styled, filterable selection screen on `renderer` and attach it to
// the root. Wires type-to-filter via the renderer key input and focuses the list
// (so up/down + Enter work). Returns helpers for tests + the interactive driver.
export function buildSelectScreen(renderer, { title = "Select", subtitle = "", footer = DEFAULT_FOOTER, items = [] } = {}) {
	const all = items.slice();
	let query = "";
	let visible = all.slice();

	const frame = new BoxRenderable(renderer, {
		id: "dbt-erd-frame",
		flexDirection: "column",
		width: "100%",
		height: "100%",
		padding: 1,
		backgroundColor: THEME.bg,
		border: true,
		borderStyle: "rounded",
		borderColor: THEME.accent,
		title: ` ${title} `,
		titleColor: THEME.accent,
		titleAlignment: "left",
		bottomTitle: ` ${footer} `,
		bottomTitleAlignment: "right",
	});

	if (subtitle) {
		frame.add(new TextRenderable(renderer, { id: "subtitle", content: subtitle, fg: THEME.dim }));
	}

	const filterText = new TextRenderable(renderer, {
		id: "filter",
		content: filterLine(query, visible.length, all.length),
		fg: THEME.accent,
	});

	const select = new SelectRenderable(renderer, {
		id: "browse-select",
		flexGrow: 1,
		showDescription: true,
		showScrollIndicator: true,
		wrapSelection: true,
		itemSpacing: 1,
		textColor: THEME.fg,
		descriptionColor: THEME.dim,
		focusedBackgroundColor: THEME.focusBg,
		selectedBackgroundColor: THEME.accent,
		selectedTextColor: THEME.accentText,
		selectedDescriptionColor: THEME.accentText,
		options: toOptions(visible),
	});

	frame.add(filterText);
	frame.add(select);
	renderer.root.add(frame);

	const applyQuery = (next) => {
		query = next;
		visible = fuzzyFilter(all, query);
		select.options = toOptions(visible);
		select.setSelectedIndex(0);
		filterText.content = filterLine(query, visible.length, all.length);
	};

	const isBackspace = (key) => key.name === "backspace" || key.sequence === "\u007f" || key.sequence === "\b";

	const onFilterKey = (key) => {
		if (!key) return;
		if (isBackspace(key)) {
			if (query) applyQuery(query.slice(0, -1));
			return;
		}
		const ch = key.sequence;
		if (!key.ctrl && !key.meta && typeof ch === "string" && ch.length === 1 && ch >= " " && ch !== "\u007f") {
			applyQuery(query + ch);
		}
	};

	renderer.keyInput?.on("keypress", onFilterKey);
	select.focus();

	return {
		frame,
		select,
		filterText,
		getQuery: () => query,
		getVisible: () => visible.slice(),
		applyQuery,
		dispose: () => {
			try { renderer.keyInput?.off?.("keypress", onFilterKey); } catch { }
		},
	};
}

// Render a single-select list with type-to-filter. `items`: [{ name, description?, value }].
// Resolves to the selected item's `value` (falls back to the item), or `null` if
// cancelled. Auto-resolves a single item without rendering.
export async function selectInteractive({ title = "Select", subtitle = "", footer = DEFAULT_FOOTER, items } = {}) {
	if (!Array.isArray(items) || items.length === 0) {
		throw new Error("selectInteractive: no items to choose from");
	}
	if (items.length === 1) {
		const only = items[0];
		return only.value !== undefined ? only.value : only;
	}

	const renderer = await createCliRenderer({ exitOnCtrlC: false });
	let settled = false;

	return await new Promise((resolve) => {
		const onCancelKey = (key) => {
			if (key?.name === "escape" || (key?.ctrl && key?.name === "c")) finish(null);
		};
		const finish = (value) => {
			if (settled) return;
			settled = true;
			try { renderer.keyInput?.off?.("keypress", onCancelKey); } catch { }
			try { screen.dispose(); } catch { }
			try { renderer.stop?.(); } catch { }
			try { renderer.destroy?.(); } catch { }
			resolve(value);
		};

		const screen = buildSelectScreen(renderer, { title, subtitle, footer, items });

		screen.select.on(SelectRenderableEvents.ITEM_SELECTED, () => {
			const option = screen.select.getSelectedOption();
			if (!option) return;
			finish(option.value !== undefined ? option.value : option);
		});

		renderer.keyInput?.on("keypress", onCancelKey);
		renderer.start();
	});
}
