// BigQuery parser — extracts CTEs from WITH ... AS (...) blocks.
//
// Each CTE becomes a table node. Columns are derived from the SELECT list
// (aliases preferred; bare expressions get a generated name). Relations are
// inferred from FROM / JOIN references to other CTEs or backtick-quoted BQ
// table refs (`project.dataset.table`).

// Strip single-line (--) and block (/* */) comments, preserving newlines.
// Quote-aware: passes string literals through intact so '--' inside a string
// is not treated as a comment.
function stripCommentsBQ(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i], c2 = sql[i + 1];
    if (c === '-' && c2 === '-') {
      while (i < n && sql[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && c2 === '*') {
      out += '  '; i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        out += sql[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n) { out += '  '; i += 2; }
    } else if (c === "'" || c === '"' || c === '`') {
      out += c; i++;
      while (i < n) { out += sql[i]; const done = sql[i] === c && sql[i - 1] !== '\\'; i++; if (done) break; }
    } else {
      out += c; i++;
    }
  }
  return out;
}

// Find the matching closing paren for the '(' at position `start`.
function findClose(s, start) {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0) return i; }
    else if (s[i] === '`') { i++; while (i < s.length && s[i] !== '`') i++; }
    else if (s[i] === "'") { i++; while (i < s.length && s[i] !== "'") i++; }
    else if (s[i] === '"') { i++; while (i < s.length && s[i] !== '"') i++; }
  }
  return -1;
}

// Extract top-level comma-separated segments (depth-aware, quote-aware).
function topSegments(s) {
  const segs = [];
  let depth = 0, start = 0, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(' || c === '[') { depth++; i++; continue; }
    if (c === ')' || c === ']') { depth--; i++; continue; }
    if (c === '`' || c === "'" || c === '"') {
      const q = c; i++;
      while (i < s.length && s[i] !== q) i++;
      i++; continue;
    }
    if (c === ',' && depth === 0) { segs.push(s.slice(start, i).trim()); start = i + 1; }
    i++;
  }
  const last = s.slice(start).trim();
  if (last) segs.push(last);
  return segs;
}

// Bare identifier from a possibly-quoted / backtick token (last dotted part).
function bareId(tok) {
  if (!tok) return '';
  tok = tok.trim().replace(/^`/, '').replace(/`$/, '')
           .replace(/^"/, '').replace(/"$/, '');
  const parts = tok.split('.');
  return parts[parts.length - 1].trim();
}

// Column name from a SELECT expression: alias wins, else last bare word.
function colNameFromExpr(expr) {
  expr = expr.trim();
  // AS alias (possibly quoted)
  const asM = expr.match(/\bas\s+(`[^`]+`|"[^"]+"|[\w$]+)\s*$/i);
  if (asM) return bareId(asM[1]);
  // plain `table`.`col` or table.col — last dotted segment
  const lastTok = expr.match(/(`[^`]+`|[\w$]+)\s*$/);
  if (lastTok) return bareId(lastTok[1]);
  return null;
}

// Extract table/CTE names referenced in a FROM / JOIN clause body.
// Returns an array of bare names (lower-case).
function refsFromBody(body) {
  const names = [];
  // Match FROM / JOIN followed by a backtick ref or plain identifier (no subquery)
  const re = /\b(?:from|join)\s+(`[^`]+`(?:\.[`\w]+)*|[\w$]+(?:\.[\w$]+)*)/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (body[re.lastIndex] === '(') continue;   // table-valued function e.g. UNNEST(…)
    names.push(bareId(m[1]).toLowerCase());
  }
  return names;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function parseBigQuery(sql) {
  const S = stripCommentsBQ(sql || '');
  const errors = [];
  const tables = [];   // ordered CTE list
  const tableIndex = new Map();  // lower name -> table object
  const relations = [];

  // Match the WITH keyword that opens the CTE block. We scan for
  // WITH <name> AS ( iteratively to handle multiple CTEs.
  // Strategy: find "WITH" at statement start, then repeatedly consume
  // cte_name AS ( body ).
  const withM = S.match(/\bwith\b/i);
  if (!withM) {
    return { tables, relations, errors: ['No WITH block found'] };
  }

  let pos = withM.index + withM[0].length;

  // Consume CTEs: name AS ( body ) [,] ...
  const cteRe = /\s*([`"]?[\w$]+[`"]?)(?:\s*\([^)]*\))?\s+as\s*\(/iy;
  while (pos < S.length) {
    cteRe.lastIndex = pos;
    const nameM = cteRe.exec(S);
    if (!nameM) break;

    const cteName = bareId(nameM[1]);
    const openParen = nameM.index + nameM[0].length - 1;
    const closeIdx = findClose(S, openParen);
    if (closeIdx < 0) { errors.push(`Unbalanced parens in CTE "${cteName}"`); break; }

    const body = S.slice(openParen + 1, closeIdx);

    // -- derive columns from SELECT list --
    const selectM = body.match(/\bselect\b([\s\S]*?)(?:\bfrom\b|$)/i);
    const cols = [];
    if (selectM) {
      const selectList = selectM[1].trim();
      if (selectList === '*') {
        // wildcard — no column info available
      } else {
        let n = 1;
        for (const seg of topSegments(selectList)) {
          if (!seg || seg === '*') continue;
          const name = colNameFromExpr(seg) || `col${n}`;
          cols.push({ name, type: '', pk: false, nn: false, unique: false, fk: false,
                      nameSpan: null, typeSpan: null });
          n++;
        }
      }
    }

    const key = cteName.toLowerCase();
    const tableObj = {
      name: cteName,
      key,
      columns: cols,
      colIndex: new Map(cols.map(c => [c.name.toLowerCase(), c])),
      colRefs: [],
      nameSpan: null,
      bodySpan: null,
    };
    tables.push(tableObj);
    tableIndex.set(key, tableObj);

    // advance past closing paren, skip optional comma
    pos = closeIdx + 1;
    const afterClose = S.slice(pos).match(/^\s*,/);
    if (afterClose) pos += afterClose[0].length;
    else break; // no comma → end of CTE list
  }

  // -- infer relations from FROM / JOIN references inside each CTE --
  // Re-parse: go back over the original stripped SQL for each CTE body.
  // We need body text. Re-extract using the same CTE name order.
  {
    const withMatch = S.match(/\bwith\b/i);
    let scanPos = withMatch ? withMatch.index + withMatch[0].length : 0;
    for (const t of tables) {
      // locate "name AS (" in remaining text
      const re = new RegExp(`\\b${escapeRe(t.name)}\\b\\s+as\\s*\\(`, 'i');
      const m = re.exec(S.slice(scanPos));
      if (!m) continue;
      const absOpen = scanPos + m.index + m[0].length - 1;
      const absClose = findClose(S, absOpen);
      if (absClose < 0) continue;
      const body = S.slice(absOpen + 1, absClose);

      for (const refName of refsFromBody(body)) {
        const toTable = tableIndex.get(refName);
        // relation to another CTE
        if (toTable && toTable.key !== t.key) {
          relations.push({
            fromTable: t.name,
            fromCols: [],
            toTable: toTable.name,
            toCols: [],
            toMissing: false,
            refSpan: null,
          });
        }
        // relation to a base table (backtick-quoted BQ ref not matching any CTE)
        // — these appear as `project.dataset.table` in the original SQL
        if (!toTable) {
          // find the full backtick ref for display
          const btRe = new RegExp('`[^`]*\\.' + escapeRe(refName) + '[^`]*`', 'i');
          const btM = body.match(btRe);
          const displayName = btM ? bareId(btM[0]) : refName;
          // only add a relation if we haven't already added one for this source
          const key = displayName.toLowerCase();
          if (!tableIndex.has(key)) {
            // create a stub table for the base ref
            const stub = {
              name: displayName,
              key,
              columns: [],
              colIndex: new Map(),
              colRefs: [],
              nameSpan: null,
              bodySpan: null,
            };
            tables.push(stub);
            tableIndex.set(key, stub);
          }
          relations.push({
            fromTable: t.name,
            fromCols: [],
            toTable: displayName,
            toCols: [],
            toMissing: false,
            refSpan: null,
          });
        }
      }
      scanPos = absClose + 1;
    }
  }

  // deduplicate relations (same fromTable + toTable pair)
  const seen = new Set();
  const dedupedRelations = relations.filter(r => {
    const k = r.fromTable.toLowerCase() + '→' + r.toTable.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { tables, relations: dedupedRelations, errors };
}
