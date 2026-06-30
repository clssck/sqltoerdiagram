// Turn a canvas edit into a surgical text edit on the original SQL, using the
// source spans recorded by the parser. Only the touched identifier(s) change —
// comments, formatting and unsupported clauses are preserved.

// change kinds:
//   { kind: 'table',       tableKey, value }
//   { kind: 'column-name', tableKey, colName, value }
//   { kind: 'column-type', tableKey, colName, value }
//
// Returns { sql, newKey } or null if nothing could be applied.
export function applyEdit(sql, model, change) {
  const table = model.tables.find(t => t.key === change.tableKey);
  if (!table) return null;
  const value = change.value;
  const splices = [];   // { start, end, text }
  let newKey = null;

  if (change.kind === 'table') {
    if (!table.nameSpan) return null;
    splices.push({ start: table.nameSpan[0], end: table.nameSpan[1], text: value });
    // keep FK references to this table valid
    for (const r of model.relations) {
      if (r.refSpan && r.toTable.toLowerCase() === change.tableKey) {
        splices.push({ start: r.refSpan[0], end: r.refSpan[1], text: value });
      }
    }
    newKey = value.toLowerCase();
  } else if (change.kind === 'column-name') {
    const col = table.columns.find(c => c.name === change.colName);
    if (!col || !col.nameSpan) return null;
    splices.push({ start: col.nameSpan[0], end: col.nameSpan[1], text: value });
    // table-level PK/FK/UNIQUE clauses that list this column
    const lc = change.colName.toLowerCase();
    for (const ref of table.colRefs || []) {
      if (ref.name === lc) splices.push({ start: ref.start, end: ref.end, text: value });
    }
  } else if (change.kind === 'column-type') {
    const col = table.columns.find(c => c.name === change.colName);
    if (!col) return null;
    if (col.typeSpan) {
      splices.push({ start: col.typeSpan[0], end: col.typeSpan[1], text: value });
    } else if (col.nameSpan) {
      // no type present — insert one right after the column name
      splices.push({ start: col.nameSpan[1], end: col.nameSpan[1], text: ' ' + value });
    } else return null;
  } else {
    return null;
  }

  return { sql: applySplices(sql, splices), newKey };
}

// Insert a new column definition into a table's CREATE body, preserving the
// existing indentation style. Returns { sql, colName } or null.
export function addColumn(sql, model, tableKey, name, type) {
  const table = model.tables.find(t => t.key === tableKey);
  if (!table || !table.bodySpan) return null;
  const [bs, be] = table.bodySpan;
  const body = sql.slice(bs, be);

  // insertion point = just after the last non-whitespace char of the body
  let i = body.length;
  while (i > 0 && /\s/.test(body[i - 1])) i--;
  const insAt = bs + i;

  const multiline = body.includes('\n');
  // reuse the indentation of the line we're inserting after
  let indent = '  ';
  if (multiline) {
    const before = sql.slice(0, insAt);
    const lineStart = before.lastIndexOf('\n') + 1;
    const m = sql.slice(lineStart, insAt).match(/^\s*/);
    if (m && m[0]) indent = m[0];
  }

  const hasCols = table.columns.length > 0;
  const def = `${name} ${type}`;
  let sep;
  if (hasCols) sep = multiline ? `,\n${indent}` : ', ';
  else sep = multiline ? `\n${indent}` : '';

  const out = sql.slice(0, insAt) + sep + def + sql.slice(insAt);
  return { sql: out, colName: name };
}

// Apply non-overlapping splices right-to-left so earlier offsets stay valid.
function applySplices(sql, splices) {
  const sorted = splices.slice().sort((a, b) => b.start - a.start);
  let out = sql;
  let lastStart = Infinity;
  for (const s of sorted) {
    if (s.end > lastStart) continue;   // skip accidental overlap
    out = out.slice(0, s.start) + s.text + out.slice(s.end);
    lastStart = s.start;
  }
  return out;
}
