// Serialize the normalized model ({ tables, relations }) to text formats.
// Used by the Export menu and by the converter landing pages.
//
// Model shape (see formats/util.js):
//   table:  { name, key, columns:[{ name, type, pk, nn, unique, fk }] }
//   rel:    { fromTable, fromCols[], toTable, toCols[], toMissing }
// A relation means fromTable.fromCols references toTable.toCols (FK -> PK side).

const WORD = /^[A-Za-z_]\w*$/;

// ---- Mermaid erDiagram ----
function mmName(s) {
  return WORD.test(s) ? s : '"' + String(s).replace(/"/g, '') + '"';
}
function mmType(t) {
  if (!t) return 'unknown';
  // Mermaid attribute types must be a single token: collapse whitespace,
  // keep parens/commas so numeric(10,2) survives.
  return t.trim().replace(/\s+/g, '_').replace(/[^\w(),]/g, '') || 'unknown';
}
export function toMermaid(model) {
  const L = ['erDiagram'];
  for (const t of model.tables) {
    L.push('    ' + mmName(t.name) + ' {');
    for (const c of t.columns) {
      const keys = [];
      if (c.pk) keys.push('PK');
      if (c.fk) keys.push('FK');
      if (c.unique && !c.pk) keys.push('UK');
      L.push('        ' + mmType(c.type) + ' ' + mmName(c.name) + (keys.length ? ' ' + keys.join(',') : ''));
    }
    L.push('    }');
  }
  for (const r of model.relations) {
    if (r.toMissing) continue;
    const label = (r.fromCols && r.fromCols[0]) || 'fk';
    // parent (PK side) ||--o{ child (FK side)
    L.push('    ' + mmName(r.toTable) + ' ||--o{ ' + mmName(r.fromTable) + ' : ' + JSON.stringify(label));
  }
  return L.join('\n') + '\n';
}

// ---- DBML (dbdiagram.io) ----
function dq(s) { return '"' + String(s).replace(/"/g, '') + '"'; }
function dbmlType(t) {
  if (!t) return 'unknown';
  const s = t.trim();
  // bare single-token types stay unquoted; anything with spaces gets quoted
  return /^[\w()]+$/.test(s) ? s : dq(s);
}
export function toDBML(model) {
  const L = [];
  for (const t of model.tables) {
    L.push('Table ' + dq(t.name) + ' {');
    for (const c of t.columns) {
      const set = [];
      if (c.pk) set.push('pk');
      if (c.unique && !c.pk) set.push('unique');
      if (c.nn && !c.pk) set.push('not null');
      L.push('  ' + dq(c.name) + ' ' + dbmlType(c.type) + (set.length ? ' [' + set.join(', ') + ']' : ''));
    }
    L.push('}');
    L.push('');
  }
  for (const r of model.relations) {
    if (r.toMissing) continue;
    const fc = r.fromCols && r.fromCols[0];
    const tc = r.toCols && r.toCols[0];
    if (!fc || !tc) continue;
    L.push('Ref: ' + dq(r.fromTable) + '.' + dq(fc) + ' > ' + dq(r.toTable) + '.' + dq(tc));
  }
  return L.join('\n').trim() + '\n';
}

// ---- PlantUML (entity / IE notation) ----
function puAlias(s, used) {
  let a = String(s).replace(/[^A-Za-z0-9_]/g, '_');
  if (!a || /^\d/.test(a)) a = 'e_' + a;
  let base = a, i = 2;
  while (used.has(a)) a = base + '_' + (i++);
  used.add(a);
  return a;
}
export function toPlantUML(model) {
  const L = ['@startuml', 'hide circle', 'skinparam linetype ortho', ''];
  const alias = new Map();
  const used = new Set();
  for (const t of model.tables) alias.set(t.key, puAlias(t.name, used));
  for (const t of model.tables) {
    L.push('entity ' + JSON.stringify(t.name) + ' as ' + alias.get(t.key) + ' {');
    const pks = t.columns.filter((c) => c.pk);
    const rest = t.columns.filter((c) => !c.pk);
    for (const c of pks) L.push('  * ' + c.name + ' : ' + (c.type || '') + ' <<PK>>');
    if (pks.length && rest.length) L.push('  --');
    for (const c of rest) L.push('  ' + c.name + ' : ' + (c.type || '') + (c.fk ? ' <<FK>>' : ''));
    L.push('}');
    L.push('');
  }
  for (const r of model.relations) {
    if (r.toMissing) continue;
    const a = alias.get((r.fromTable || '').toLowerCase());
    const b = alias.get((r.toTable || '').toLowerCase());
    if (!a || !b) continue;
    L.push(b + ' ||--o{ ' + a);
  }
  L.push('@enduml');
  return L.join('\n') + '\n';
}

// dispatcher used by the Export menu
export const SERIALIZERS = {
  mermaid: { label: 'Mermaid', ext: 'mmd', fn: toMermaid },
  dbml: { label: 'DBML', ext: 'dbml', fn: toDBML },
  plantuml: { label: 'PlantUML', ext: 'puml', fn: toPlantUML },
};

export function serialize(model, fmt) {
  const s = SERIALIZERS[fmt];
  return s ? s.fn(model) : '';
}
