// Prisma schema parser (schema.prisma). Declarative — clean to parse.
// model -> table, scalar/enum field -> column, @id/@unique/optional handled,
// @relation(fields:[..], references:[..]) -> relation. Relation fields whose
// type is another model are virtual (not columns).
import { makeTable, addColumn, finalize, balanced } from './util.js';

const SCALARS = new Set(['int', 'bigint', 'float', 'decimal', 'string', 'boolean', 'bool', 'datetime', 'date', 'json', 'bytes', 'unsupported']);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // // comments (avoid eating :// just in case)
}

export function parsePrisma(src) {
  const text = stripComments(src || '');
  const tables = [];
  const rels = [];

  // collect model & enum names first (so we can tell relation fields from scalars)
  const modelNames = new Set();
  const enumNames = new Set();
  let m;
  const blockRe = /\b(model|enum)\s+([A-Za-z_]\w*)\s*\{/g;
  while ((m = blockRe.exec(text))) {
    if (m[1] === 'model') modelNames.add(m[2].toLowerCase());
    else enumNames.add(m[2].toLowerCase());
  }

  blockRe.lastIndex = 0;
  while ((m = blockRe.exec(text))) {
    const kind = m[1];
    const name = m[2];
    const b = balanced(text, m.index, '{', '}');
    if (!b) continue;
    const body = text.slice(b[0], b[1]);
    blockRe.lastIndex = b[2];
    if (kind !== 'model') continue;

    const table = makeTable(name);
    const blockPk = [];   // from @@id([...])
    const blockUniq = [];

    for (let line of body.split('\n')) {
      line = line.trim();
      if (!line) continue;
      if (line.startsWith('@@')) {
        const idm = line.match(/@@id\(\s*\[([^\]]*)\]/);
        if (idm) idm[1].split(',').forEach((c) => blockPk.push(c.trim().toLowerCase()));
        const um = line.match(/@@unique\(\s*\[([^\]]*)\]/);
        if (um) um[1].split(',').forEach((c) => blockUniq.push(c.trim().toLowerCase()));
        continue;
      }
      const fm = line.match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(\[\])?(\?)?\s*(.*)$/);
      if (!fm) continue;
      const [, fname, baseType, list, opt, attrs] = fm;
      const bt = baseType.toLowerCase();

      if (modelNames.has(bt)) {
        // relation (virtual) field — capture @relation FK if present on this side
        const rm = attrs.match(/@relation\([^)]*fields:\s*\[([^\]]*)\][^)]*references:\s*\[([^\]]*)\]/);
        if (rm) {
          rels.push({
            fromTable: name,
            fromCols: rm[1].split(',').map((s) => s.trim()).filter(Boolean),
            toTable: baseType,
            toCols: rm[2].split(',').map((s) => s.trim()).filter(Boolean),
          });
        }
        continue; // not a column
      }

      // scalar or enum field -> column
      const type = bt && (SCALARS.has(bt) || enumNames.has(bt)) ? baseType : baseType;
      addColumn(table, {
        name: fname,
        type: type + (list ? '[]' : '') + (opt ? '?' : ''),
        pk: /@id\b/.test(attrs),
        unique: /@unique\b/.test(attrs),
        nn: !opt,
      });
    }

    for (const c of table.columns) {
      if (blockPk.includes(c.name.toLowerCase())) c.pk = true;
      if (blockUniq.includes(c.name.toLowerCase())) c.unique = true;
    }
    tables.push(table);
  }

  return finalize(tables, rels);
}
