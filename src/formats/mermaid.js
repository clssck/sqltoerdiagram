// Mermaid erDiagram importer — view-only. Produces the normalized model.
import { makeTable, addColumn, finalize, balanced } from './util.js';

const unq = (s) => {
  s = (s || '').trim();
  if (s[0] === '"' && s.endsWith('"')) return s.slice(1, -1);
  return s;
};

export function parseMermaid(text) {
  let t = (text || '').replace(/%%[^\n]*/g, ''); // strip %% comments
  const tables = [];
  const rels = [];
  const byKey = new Map();

  // --- entity blocks:  NAME { ... }  (NAME may be quoted) ---
  const entRe = /(^|\n)\s*("[^"]+"|[A-Za-z_]\w*)\s*\{/g;
  let m;
  while ((m = entRe.exec(t))) {
    const name = unq(m[2]);
    if (name.toLowerCase() === 'erdiagram') continue;
    const open = t.indexOf('{', m.index);
    const b = balanced(t, open, '{', '}');
    if (!b) continue;
    const body = t.slice(b[0], b[1]);
    const table = makeTable(name);
    for (let line of body.split('\n')) {
      line = line.trim();
      if (!line) continue;
      // attribute:  type name [KEY[,KEY]] ["comment"]
      const am = /^("[^"]+"|\S+)\s+("[^"]+"|\S+)(.*)$/.exec(line);
      if (!am) continue;
      const type = unq(am[1]);
      const colName = unq(am[2]);
      const rest = (am[3] || '').toUpperCase();
      addColumn(table, {
        name: colName,
        type,
        pk: /\bPK\b/.test(rest),
        unique: /\bUK\b/.test(rest),
        nn: false,
      });
      if (/\bFK\b/.test(rest)) { const c = table.colIndex.get(colName.toLowerCase()); if (c) c.fk = true; }
    }
    tables.push(table);
    byKey.set(table.key, table);
  }

  // --- relationships:  A <card>--<card> B : label  (also .. for non-identifying) ---
  const relRe = /(^|\n)\s*("[^"]+"|[A-Za-z_]\w*)\s*([|}{o<>]*(?:--|\.\.)[|}{o<>]*)\s*("[^"]+"|[A-Za-z_]\w*)\s*:/g;
  while ((m = relRe.exec(t))) {
    const left = unq(m[2]);
    const card = m[3];
    const right = unq(m[4]);
    const [lc, rc] = card.split(/--|\.\./);
    // the crow's-foot "many" side ({ or o{) is the child holding the FK
    let fromT, toT;
    if (/\{/.test(rc)) { fromT = right; toT = left; }
    else if (/\{/.test(lc)) { fromT = left; toT = right; }
    else { fromT = right; toT = left; } // default: right references left
    rels.push({ fromTable: fromT, fromCols: [], toTable: toT, toCols: [] });
  }

  return finalize(tables, rels);
}
