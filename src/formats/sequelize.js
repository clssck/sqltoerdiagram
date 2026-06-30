// Sequelize parser — best-effort for the common styles:
//   sequelize.define('User', { id: { type: DataTypes.INTEGER, primaryKey: true }, ... })
//   class User extends Model {}  User.init({ ...fields... }, { modelName: 'User' })
// Field-level `references: { model: 'x', key: 'id' }` and association calls
// (belongsTo / hasMany / hasOne / belongsToMany) become relations.
// Heuristic (JS isn't fully parsed) — unusual code may be missed.
import { makeTable, addColumn, finalize, balanced, splitTopCommas } from './util.js';

function parseFields(table, fieldsObj, rels, tableName) {
  for (const part of splitTopCommas(fieldsObj)) {
    const km = part.match(/^\s*['"]?([A-Za-z_]\w*)['"]?\s*:/);
    if (!km) continue;
    const name = km[1];
    const val = part.slice(part.indexOf(':') + 1).trim();

    // shorthand  name: DataTypes.STRING
    const short = val.match(/^DataTypes\.(\w+)/);
    let type = '';
    let pk = false, nn = false, unique = false;
    if (short) {
      type = short[1];
    } else {
      const tm = val.match(/type\s*:\s*DataTypes\.(\w+)/);
      if (tm) type = tm[1];
      pk = /primaryKey\s*:\s*true/.test(val);
      unique = /unique\s*:\s*true/.test(val);
      nn = /allowNull\s*:\s*false/.test(val);
      const refm = val.match(/references\s*:\s*\{[^}]*model\s*:\s*['"]([^'"]+)['"][^}]*key\s*:\s*['"]([^'"]+)['"]/) ||
                   val.match(/references\s*:\s*\{[^}]*model\s*:\s*['"]([^'"]+)['"]/);
      if (refm) rels.push({ fromTable: tableName, fromCols: [name], toTable: refm[1], toCols: [refm[2] || 'id'] });
    }
    addColumn(table, { name, type, pk, nn, unique });
  }
}

export function parseSequelize(src) {
  const text = src || '';
  const tables = [];
  const rels = [];
  const byName = new Map(); // model/var name (lower) -> tableName

  // sequelize.define('Name', { fields })
  const defRe = /\.define\(\s*['"]([A-Za-z_]\w*)['"]\s*,\s*\{/g;
  let m;
  while ((m = defRe.exec(text))) {
    const name = m[1];
    const b = balanced(text, m.index + m[0].length - 1, '{', '}');
    if (!b) continue;
    const table = makeTable(name);
    parseFields(table, text.slice(b[0], b[1]), rels, name);
    tables.push(table);
    byName.set(name.toLowerCase(), name);
    defRe.lastIndex = b[2];
  }

  // ClassOrVar.init({ fields }, { modelName / tableName })
  const initRe = /([A-Za-z_]\w*)\.init\(\s*\{/g;
  while ((m = initRe.exec(text))) {
    const varName = m[1];
    const fb = balanced(text, m.index + m[0].length - 1, '{', '}');
    if (!fb) continue;
    // options object follows the fields object
    const after = text.slice(fb[2]);
    const opt = after.match(/modelName\s*:\s*['"]([^'"]+)['"]/) || after.match(/tableName\s*:\s*['"]([^'"]+)['"]/);
    const name = opt ? opt[1] : varName;
    const table = makeTable(name);
    parseFields(table, text.slice(fb[0], fb[1]), rels, name);
    tables.push(table);
    byName.set(name.toLowerCase(), name);
    byName.set(varName.toLowerCase(), name);
    initRe.lastIndex = fb[2];
  }

  // associations:  A.belongsTo(B, { foreignKey: 'x' })  etc.
  const assocRe = /([A-Za-z_]\w*)\s*\.\s*(belongsTo|hasMany|hasOne|belongsToMany)\(\s*([A-Za-z_]\w*)([^)]*)\)/g;
  while ((m = assocRe.exec(text))) {
    const [, a, kind, b, opts] = m;
    const aT = byName.get(a.toLowerCase()) || a;
    const bT = byName.get(b.toLowerCase()) || b;
    const fkm = opts.match(/foreignKey\s*:\s*['"]?(\w+)['"]?/);
    if (kind === 'belongsTo') {
      // A holds the FK -> B
      rels.push({ fromTable: aT, fromCols: [fkm ? fkm[1] : b.toLowerCase() + 'Id'], toTable: bT, toCols: ['id'] });
    } else if (kind === 'hasMany' || kind === 'hasOne') {
      // B holds the FK -> A
      rels.push({ fromTable: bT, fromCols: [fkm ? fkm[1] : a.toLowerCase() + 'Id'], toTable: aT, toCols: ['id'] });
    }
    // belongsToMany implies a junction table we can't reliably name — skip
  }

  return finalize(tables, rels);
}
