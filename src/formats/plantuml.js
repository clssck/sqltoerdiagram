// PlantUML (entity / class IE-notation) importer — view-only.
import { makeTable, addColumn, finalize, balanced } from './util.js';

const unq = (s) => {
  s = (s || '').trim();
  if (s[0] === '"' && s.endsWith('"')) return s.slice(1, -1);
  return s;
};

export function parsePlantUML(text) {
  let t = (text || '').replace(/'[^\n]*/g, ''); // strip ' line comments
  const tables = [];
  const rels = [];
  const aliasToKey = new Map(); // alias/name -> table.key

  // --- entity / class blocks ---
  //   entity "Name" as alias {        entity Name {        class Name as alias {
  const entRe = /\b(?:entity|class|table)\b\s+("[^"]+"|\w+)(?:\s+as\s+(\w+))?\s*\{/gi;
  let m;
  while ((m = entRe.exec(t))) {
    const name = unq(m[1]);
    const alias = m[2] || name;
    const open = t.indexOf('{', m.index);
    const b = balanced(t, open, '{', '}');
    if (!b) continue;
    const body = t.slice(b[0], b[1]);
    const table = makeTable(name);
    for (let line of body.split('\n')) {
      line = line.trim();
      if (!line || /^(--+|==+|\.\.+)$/.test(line)) continue; // separators
      let pk = false;
      line = line.replace(/^[*+#~-]\s*/, (mm) => { if (mm.trim() === '*') pk = true; return ''; });
      if (!line) continue;
      const up = line.toUpperCase();
      if (/<<PK>>|<<PRIMARY/.test(up)) pk = true;
      const fk = /<<FK>>|<<FOREIGN/.test(up);
      const clean = line.replace(/<<[^>]*>>/g, '').trim();
      // "name : type"  or  "name"
      const cm = /^([^:]+?)\s*:\s*(.+)$/.exec(clean);
      const colName = unq((cm ? cm[1] : clean).trim());
      const type = cm ? cm[2].trim() : '';
      if (!colName) continue;
      addColumn(table, { name: colName, type, pk, unique: false, nn: pk });
      if (fk) { const c = table.colIndex.get(colName.toLowerCase()); if (c) c.fk = true; }
    }
    tables.push(table);
    aliasToKey.set(alias.toLowerCase(), table.key);
    aliasToKey.set(name.toLowerCase(), table.key);
  }

  const nameOf = (alias) => {
    const k = aliasToKey.get(unq(alias).toLowerCase());
    const tb = tables.find((x) => x.key === k);
    return tb ? tb.name : null;
  };

  // --- relationship lines:  A ||--o{ B   /   A }o--|| B   /   A --> B ---
  // scan line-by-line (a global regex would consume the newline delimiter and
  // skip every other relationship).
  const relLine = /^("[^"]+"|\w+)\s+(\S+)\s+("[^"]+"|\w+)(?:\s*:.*)?$/;
  for (let line of t.split('\n')) {
    line = line.trim();
    if (!line || /\bentity\b|\bclass\b|\btable\b/i.test(line)) continue; // skip block headers
    if (!/--|\.\.|->|<-/.test(line)) continue; // must contain a connector (crow's-foot has -- )
    const mm = relLine.exec(line);
    if (!mm) continue;
    const lName = nameOf(mm[1]), conn = mm[2], rName = nameOf(mm[3]);
    if (!lName || !rName) continue;
    const [lc, rc] = conn.split(/--+|\.\.+|>|</);
    let fromT, toT;
    if (/\{/.test(rc || '')) { fromT = rName; toT = lName; }
    else if (/\{/.test(lc || '')) { fromT = lName; toT = rName; }
    else if (/>/.test(conn)) { fromT = lName; toT = rName; }
    else { fromT = rName; toT = lName; }
    rels.push({ fromTable: fromT, fromCols: [], toTable: toT, toCols: [] });
  }

  return finalize(tables, rels);
}
