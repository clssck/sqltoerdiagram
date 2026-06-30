// Grouping modes for the viewer's "Group by" control. Each dbt table carries
// candidate keys in `t.groups` ({ domain, layer, folder, schema }); this module
// decides which of those dimensions are worth offering (adaptive — only the ones
// with real cluster structure) and applies the chosen one to `t.group`, which is
// what the layout (compound clustering) and renderer (header tint) read.
//
// "None" is always available and means the flat, ungrouped view.

export const GROUP_MODES = [
  { key: 'domain', label: 'Domain' },
  { key: 'layer', label: 'Layer' },
  { key: 'folder', label: 'Folder' },
  { key: 'schema', label: 'Schema' },
];

export function groupValue(t, key) {
  return (t.groups && typeof t.groups[key] === 'string') ? t.groups[key] : '';
}

// A mode has usable structure when it splits the tables into ≥2 real clusters
// (≥2 members each) without one giant catch-all (>90%). Singleton-only or
// everything-in-one-bucket dimensions are dropped so the dropdown only shows
// groupings that actually de-clutter the diagram.
export function modeHasSignal(tables, key) {
  const counts = new Map();
  let assigned = 0;
  for (const t of tables) {
    const v = groupValue(t, key).trim();
    if (!v) continue;
    assigned++;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  if (counts.size < 2) return false;
  const sizes = [...counts.values()];
  const multiMember = sizes.filter((n) => n >= 2).length;
  if (multiMember < 2) return false;
  const biggest = Math.max(...sizes);
  if (biggest / tables.length > 0.9) return false;
  // require most tables to be classifiable, else the grouping is mostly noise
  return assigned >= tables.length * 0.5;
}

// The modes to offer for this model, in GROUP_MODES order, each with a distinct
// group count. Always returns at least [] (the caller prepends "None").
export function availableGroupModes(tables) {
  if (!Array.isArray(tables) || tables.length === 0) return [];
  return GROUP_MODES
    .filter((m) => modeHasSignal(tables, m.key))
    .map((m) => ({
      ...m,
      count: new Set(tables.map((t) => groupValue(t, m.key).trim()).filter(Boolean)).size,
    }));
}

// Set `t.group` for every table from the chosen mode ('' / 'none' => ungrouped).
// Only values with ≥2 members become clusters; singletons stay ungrouped so we
// don't draw one-node bands or pad the legend with noise.
export function applyGroupMode(tables, key) {
  const active = key && key !== 'none';
  if (!active) {
    for (const t of tables) t.group = '';
    return;
  }
  const counts = new Map();
  for (const t of tables) {
    const v = groupValue(t, key).trim();
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  for (const t of tables) {
    const v = groupValue(t, key).trim();
    t.group = (v && counts.get(v) >= 2) ? v : '';
  }
}
