// Canvas renderer. Each table is rasterised once to an offscreen bitmap and
// re-used while panning/zooming, so frame cost is dominated by cheap drawImage
// + line drawing rather than per-glyph text layout. Off-screen tables/edges
// are culled. This keeps hundreds of tables smooth.

const FONT_STACK = "13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const HEADER_FONT = "600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const TYPE_FONT = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const ROW_H = 26;
const HEADER_H = 34;
const PAD_X = 12;
const GAP = 14;          // gap between name and type columns
const BADGE_W = 30;      // space reserved for PK/FK badges
const MIN_W = 140;
const MAX_W = 360;

// ---- collapse-aware column visibility -------------------------------------
// Wide tables render a fixed head of columns + a "+N more" footer row; the
// footer doubles as a click target that toggles `t.collapsed`. A table is only
// collapsible above the threshold (nothing to hide below it). `collapsed` is a
// plain boolean on the table so it survives JSON round-trips and can be set
// before the first layout().
export const COLLAPSE_THRESHOLD = 8;

export function isCollapsible(t) {
  return (t.columns?.length || 0) > COLLAPSE_THRESHOLD;
}

// The columns actually drawn for a table given its collapse state.
export function visibleColumns(t) {
  return t.collapsed && isCollapsible(t) ? t.columns.slice(0, COLLAPSE_THRESHOLD) : t.columns;
}

// Footer-row descriptor ("+N more" / "show less") or null. Requires an explicit
// `collapsed` boolean: tables that never opt in (the SQL app) get no footer and
// behave exactly as before.
export function tableFooter(t) {
  if (typeof t.collapsed !== 'boolean' || !isCollapsible(t)) return null;
  const hidden = t.columns.length - COLLAPSE_THRESHOLD;
  return t.collapsed ? { collapsed: true, label: `+${hidden} more` } : { collapsed: false, label: 'show less' };
}

// Stable color per dbt group/layer, legible on both themes. The viewer legend
// uses the same hash, so swatches and table headers always agree.
const GROUP_PALETTE = ['#5aa7ff', '#f5a35a', '#6fcf7f', '#c98bdb', '#f56a8a', '#4ec9c9', '#d4b95a', '#8a9bf0', '#e07a5a', '#7fb069'];
export function groupColor(group) {
  if (!group) return null;
  const s = String(group);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GROUP_PALETTE[h % GROUP_PALETTE.length];
}

const TAG_FONT = "600 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

export const THEMES = {
  dark: {
    bg: '#0e1116',
    grid: '#171c24',
    tableBg: '#1b212b',
    tableBorder: '#2b333f',
    header: '#222c3a',
    headerText: '#e8edf4',
    rowText: '#c4ccd6',
    typeText: '#6f7b8a',
    rowAlt: '#1e2530',
    pk: '#f5c451',
    fk: '#5aa7ff',
    edge: '#5d6b7d',
    edgeHi: '#5aa7ff',
    shadow: 'rgba(0,0,0,0.45)',
    divider: '#2b333f',
  },
  light: {
    bg: '#f4f6fa',
    grid: '#e6eaf0',
    tableBg: '#ffffff',
    tableBorder: '#d6dde6',
    header: '#eef2f7',
    headerText: '#1c2530',
    rowText: '#39424d',
    typeText: '#8a95a3',
    rowAlt: '#f7f9fc',
    pk: '#c8901a',
    fk: '#2f6fd0',
    edge: '#a9b4c2',
    edgeHi: '#2f6fd0',
    shadow: 'rgba(20,30,50,0.16)',
    divider: '#e3e8ef',
  },
};

// A scratch context for text measurement (no DOM needed for sizing).
let measureCanvas = null;
function measureCtx() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

export function measureTable(t) {
  const ctx = measureCtx();
  ctx.font = HEADER_FONT;
  let w = ctx.measureText(t.name).width + PAD_X * 2 + 24;
  if (t.group) {
    ctx.font = TAG_FONT;
    w += ctx.measureText(t.group).width + 12;
  }
  ctx.font = FONT_STACK;
  const cols = visibleColumns(t);
  for (const c of cols) {
    const nameW = ctx.measureText(c.name).width;
    ctx.font = TYPE_FONT;
    const typeW = ctx.measureText(c.type || '').width;
    ctx.font = FONT_STACK;
    const total = BADGE_W + nameW + GAP + typeW + PAD_X * 2;
    if (total > w) w = total;
  }
  w = Math.max(MIN_W, Math.min(MAX_W, Math.ceil(w)));
  const footer = tableFooter(t);
  const h = HEADER_H + cols.length * ROW_H + (footer ? ROW_H : 0);
  return { w, h, rowH: ROW_H, headerH: HEADER_H };
}

// Rasterise one table to a bitmap at the given pixel ratio.
export function rasterizeTable(t, theme, dpr) {
  const w = t.w, h = t.h;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * dpr);
  cv.height = Math.ceil(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);

  const r = 10;
  const cols = visibleColumns(t);
  const footer = tableFooter(t);
  const gc = groupColor(t.group);

  // body
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = theme.tableBg;
  ctx.fill();

  // rows (alternating)
  for (let i = 0; i < cols.length; i++) {
    if (i % 2 === 1) {
      ctx.fillStyle = theme.rowAlt;
      ctx.fillRect(1, HEADER_H + i * ROW_H, w - 2, ROW_H);
    }
  }

  // header
  ctx.save();
  roundRectTop(ctx, 0.5, 0.5, w - 1, HEADER_H, r);
  ctx.clip();
  ctx.fillStyle = theme.header;
  ctx.fillRect(0, 0, w, HEADER_H);
  if (gc) { ctx.fillStyle = gc; ctx.fillRect(0, 0, w, 4); }   // group accent bar
  ctx.restore();

  // header text: table name (left) + group tag (right)
  ctx.textBaseline = 'middle';
  let tagW = 0;
  if (t.group) {
    ctx.font = TAG_FONT;
    tagW = Math.min(ctx.measureText(t.group).width, w * 0.45) + 12;
  }
  ctx.fillStyle = theme.headerText;
  ctx.font = HEADER_FONT;
  ctx.fillText(truncate(ctx, t.name, w - PAD_X * 2 - 18 - tagW), PAD_X, HEADER_H / 2 + 1);
  if (t.group && gc) {
    ctx.font = TAG_FONT;
    ctx.fillStyle = gc;
    ctx.textAlign = 'right';
    ctx.fillText(truncate(ctx, t.group, w * 0.45), w - PAD_X, HEADER_H / 2 + 1);
    ctx.textAlign = 'left';
  }

  // header divider
  ctx.strokeStyle = theme.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H + 0.5);
  ctx.lineTo(w, HEADER_H + 0.5);
  ctx.stroke();

  // columns
  ctx.textBaseline = 'middle';
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const y = HEADER_H + i * ROW_H + ROW_H / 2;

    // PK / FK badge
    if (c.pk) {
      drawBadge(ctx, PAD_X - 2, y, 'PK', theme.pk);
    } else if (c.fk) {
      drawBadge(ctx, PAD_X - 2, y, 'FK', theme.fk);
    }

    const nx = PAD_X + BADGE_W - 4;
    // reserve only the space the type actually needs (not a fixed amount),
    // so short types don't force the column name to truncate
    let typeReserve = 0;
    if (c.type) {
      ctx.font = TYPE_FONT;
      typeReserve = Math.min(ctx.measureText(c.type).width, 120) + GAP;
    }
    ctx.font = FONT_STACK;
    ctx.fillStyle = theme.rowText;
    ctx.fillText(truncate(ctx, c.name, w - nx - PAD_X - typeReserve), nx, y);

    // type, right-aligned
    if (c.type) {
      ctx.font = TYPE_FONT;
      ctx.fillStyle = theme.typeText;
      ctx.textAlign = 'right';
      ctx.fillText(truncate(ctx, c.type, 120), w - PAD_X, y);
      ctx.textAlign = 'left';
    }
  }

  // footer (collapse toggle row)
  if (footer) {
    const fy = HEADER_H + cols.length * ROW_H;
    ctx.strokeStyle = theme.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, fy + 0.5);
    ctx.lineTo(w, fy + 0.5);
    ctx.stroke();
    ctx.font = "600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillStyle = theme.edgeHi;
    ctx.textBaseline = 'middle';
    ctx.fillText((footer.collapsed ? '▾  ' : '▴  ') + footer.label, PAD_X, fy + ROW_H / 2);
  }

  // border
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = theme.tableBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  return cv;
}

function drawBadge(ctx, x, y, text, color) {
  ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.font = FONT_STACK;
}

// y-position (table-local) of a column's connection point.
export function columnY(t, colName) {
  if (!colName) return t.h / 2;
  const cols = visibleColumns(t);
  const lower = colName.toLowerCase();
  const idx = cols.findIndex(c => c.name.toLowerCase() === lower);
  if (idx >= 0) return HEADER_H + idx * ROW_H + ROW_H / 2;
  // column hidden by collapse -> anchor at the footer row so edges stay on the card
  if (cols.length < t.columns.length && t.columns.some(c => c.name.toLowerCase() === lower)) {
    return HEADER_H + cols.length * ROW_H + ROW_H / 2;
  }
  return HEADER_H / 2;
}

function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

export { ROW_H, HEADER_H };
