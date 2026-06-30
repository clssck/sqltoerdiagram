// SQLAlchemy parser — best-effort for the common declarative style:
//   class User(Base):
//       __tablename__ = 'users'
//       id = Column(Integer, primary_key=True)
//       addr_id = Column(Integer, ForeignKey('addresses.id'))
// Also handles 2.0 `mapped_column(...)` and `Mapped[...]` type hints.
// It's heuristic (Python isn't fully parsed), so unusual code may be missed.
import { makeTable, addColumn, finalize, balanced } from './util.js';

const TYPE_RE = /\b(BigInteger|SmallInteger|Integer|String|Text|Unicode|Boolean|Float|Numeric|DECIMAL|Decimal|DateTime|Date|Time|Interval|JSONB|JSON|UUID|LargeBinary|Enum|ARRAY|BIGINT|INTEGER|VARCHAR|TEXT|BOOLEAN|TIMESTAMP)\b/;
const MAPPED_RE = /Mapped\[\s*['"]?(\w+)/; // Mapped[int] / Mapped['User']

function tableNameFromClass(cls) {
  return cls.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

export function parseSQLAlchemy(src) {
  const text = src || '';
  const tables = [];
  const rels = [];

  // split into class blocks: from "class X(...):" to the next top-level "class"
  const classRe = /(^|\n)class\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/g;
  const heads = [];
  let m;
  while ((m = classRe.exec(text))) {
    heads.push({ name: m[2], bases: m[3], start: m.index + (m[1] ? 1 : 0), bodyStart: classRe.lastIndex });
  }
  for (let h = 0; h < heads.length; h++) {
    const head = heads[h];
    // only model classes (Base / db.Model / DeclarativeBase / *Base)
    if (!/\b(Base|Model|DeclarativeBase)\b/.test(head.bases)) continue;
    const end = h + 1 < heads.length ? heads[h + 1].start : text.length;
    const body = text.slice(head.bodyStart, end);

    const tnMatch = body.match(/__tablename__\s*=\s*['"]([^'"]+)['"]/);
    const tableName = tnMatch ? tnMatch[1] : tableNameFromClass(head.name);
    const table = makeTable(tableName);

    // each "<attr> [: Mapped[..]] = Column(...)/mapped_column(...)"
    const colRe = /(^|\n)\s*([A-Za-z_]\w*)\s*(?::\s*([^=\n]+?))?\s*=\s*(Column|mapped_column)\s*\(/g;
    let cm;
    while ((cm = colRe.exec(body))) {
      const attr = cm[2];
      const annotation = cm[3] || '';
      const openIdx = cm.index + cm[0].lastIndexOf('(');
      const bal = balanced(body, openIdx, '(', ')');
      if (!bal) continue;
      const args = body.slice(bal[0], bal[1]);
      colRe.lastIndex = bal[2];

      // explicit column name as first string arg?
      const nameArg = args.match(/^\s*['"]([^'"]+)['"]\s*,/);
      const colName = nameArg ? nameArg[1] : attr;

      // type
      let type = '';
      const tm = args.match(TYPE_RE);
      if (tm) type = tm[1];
      else { const am = annotation.match(MAPPED_RE); if (am) type = am[1]; }

      addColumn(table, {
        name: colName,
        type,
        pk: /primary_key\s*=\s*True/.test(args),
        unique: /unique\s*=\s*True/.test(args),
        nn: /nullable\s*=\s*False/.test(args),
      });

      // ForeignKey('addresses.id')
      const fk = args.match(/ForeignKey\(\s*['"]([\w]+)\.([\w]+)['"]/);
      if (fk) rels.push({ fromTable: tableName, fromCols: [colName], toTable: fk[1], toCols: [fk[2]] });
    }

    tables.push(table);
  }

  return finalize(tables, rels);
}
