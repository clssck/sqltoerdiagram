import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { makeTable, addColumn, finalize } from '../formats/util.js';

export const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dbt_packages', 'venv', '.venv']);
export const TABLE_RESOURCE_TYPES = new Set(['model', 'seed', 'snapshot']);

export function readYamlFile(file) {
	return YAML.parse(fs.readFileSync(file, 'utf8')) ?? {};
}

export function readJsonFile(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getProjectName(projectConfig, projectDir) {
	return firstText(projectConfig?.name) || path.basename(path.resolve(projectDir));
}

function configuredPaths(projectConfig, dashedName, underscoredName, defaults) {
	const configured = projectConfig?.[dashedName] ?? projectConfig?.[underscoredName];
	if (Array.isArray(configured)) return configured.map((p) => firstText(p)).filter(Boolean);
	const single = firstText(configured);
	return single ? [single] : defaults;
}

export function getModelPaths(projectConfig) {
	return configuredPaths(projectConfig, 'model-paths', 'model_paths', ['models']);
}

export function getSeedPaths(projectConfig) {
	return configuredPaths(projectConfig, 'seed-paths', 'seed_paths', ['seeds']);
}

export function getSnapshotPaths(projectConfig) {
	return configuredPaths(projectConfig, 'snapshot-paths', 'snapshot_paths', ['snapshots']);
}

export function walkFiles(rootDir, predicate) {
	const out = [];
	function walk(dir) {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) walk(full);
			} else if (entry.isFile() && predicate(full, entry.name)) {
				out.push(full);
			}
		}
	}
	walk(rootDir);
	return out;
}

export function cleanScalar(value) {
	if (value == null || typeof value === 'object') return '';
	const text = String(value).trim();
	const quoted = text.match(/^(['"`])([\s\S]*)\1$/);
	return quoted ? quoted[2].trim() : text;
}

export function firstText(...values) {
	for (const value of values) {
		const text = cleanScalar(value);
		if (text) return text;
	}
	return '';
}

// Candidate grouping dimensions for one entry. The viewer's "Group by" dropdown
// offers whichever of these has real structure; each value is '' when that
// dimension doesn't apply. Derived from dbt metadata (dbtName/baseName/path/
// schema) — NOT the final display name, which may be schema-qualified and would
// skew token grouping toward the schema.
export function buildGroupKeys({ kind = '', resourceType = '', name = '', dbtName = '', sourceName = '', baseName = '', schema = '', pathQualifier = '', node = null } = {}) {
	return {
		domain: deriveDomain({ kind, resourceType, name, dbtName, sourceName, baseName }),
		layer: deriveLayer({ kind, resourceType, pathQualifier, node, name: dbtName || name }),
		folder: deriveFolder({ pathQualifier, node }),
		schema: firstText(schema).toLowerCase(),
	};
}

// Layer-ish prefixes stripped to find the business-domain token in a model name.
const LAYER_PREFIX = /^(stg|staging|int|intermediate|fct|fact|dim|mart|marts|rpt|agg|dwh|dw|base|src|source|raw|snap|snapshot|seed|ref|final|tmp|temp)[_.]/i;

// Business domain: the leading name token after stripping layer prefixes
// (e.g. stg_gosilico_calibration_x -> "gosilico"). For sources, the source group.
function deriveDomain({ kind, resourceType, name, dbtName, sourceName, baseName }) {
	const kinds = [firstText(resourceType).toLowerCase(), firstText(kind).toLowerCase()];
	if (kinds.includes('source') && firstText(sourceName)) {
		return firstText(sourceName).toLowerCase().split(/[_.]/).filter(Boolean)[0] || '';
	}
	let n = firstText(dbtName, name, baseName).toLowerCase();
	let prev;
	do { prev = n; n = n.replace(LAYER_PREFIX, ''); } while (n !== prev);
	const token = n.split(/[_.]/).filter(Boolean)[0];
	if (token) return token;
	return firstText(dbtName, name).toLowerCase().split(/[_.]/).filter(Boolean)[0] || '';
}

// dbt stage: kind wins for source/seed/snapshot, else the first model subfolder,
// else a name-prefix guess.
function deriveLayer({ kind, resourceType, pathQualifier, node, name }) {
	const kinds = [firstText(resourceType).toLowerCase(), firstText(kind).toLowerCase()];
	for (const winner of ['source', 'seed', 'snapshot']) {
		if (kinds.includes(winner)) return winner;
	}
	const segments = pathSegments(pathQualifier, node);
	if (segments.length >= 2) return segments[1];
	const cleanName = firstText(name).toLowerCase();
	if (/^stg_|^staging[_.]/.test(cleanName)) return 'staging';
	if (/^int_|^intermediate[_.]/.test(cleanName)) return 'intermediate';
	if (/^(fct|dim|mart|rpt|agg|fact)_/.test(cleanName)) return 'marts';
	return '';
}

// On-disk folder organization: the model path below the root models/ dir
// (e.g. models/staging/stripe -> "staging/stripe").
function deriveFolder({ pathQualifier, node }) {
	const segments = pathSegments(pathQualifier, node);
	if (segments.length <= 1) return '';
	return segments.slice(1).join('/');
}

function pathSegments(pathQualifier, node) {
	const qualifier = firstText(pathQualifier);
	const nodePath = firstText(node?.original_file_path, node?.path);
	const pathText = qualifier || (nodePath ? stripTrailingFilename(nodePath) : '');
	return pathText.replace(/\\/g, '/').split('/').filter(Boolean);
}

function stripTrailingFilename(value) {
	const normalized = firstText(value).replace(/\\/g, '/');
	const slash = normalized.lastIndexOf('/');
	return slash < 0 ? '' : normalized.slice(0, slash);
}


export function normalizeTestName(name) {
	const text = firstText(name);
	if (!text) return '';
	return text.split('.').pop();
}

export function isDisabled(object) {
	return object?.enabled === false || object?.config?.enabled === false;
}

export function isEphemeral(object) {
	return firstText(object?.materialized, object?.config?.materialized).toLowerCase() === 'ephemeral';
}

export function isSkippedWarehouseObject(object) {
	return isDisabled(object) || isEphemeral(object);
}

export function createEntry({
	uniqueId,
	kind = 'model',
	resourceType = 'model',
	name,
	dbtName = '',
	sourceName = '',
	packageName = '',
	schema = '',
	database = '',
	pathQualifier = '',
	baseName = '',
	node = null,
}) {
	const cleanName = firstText(name, String(uniqueId || '').split('.').pop());
	const cleanSourceName = firstText(sourceName);
	const defaultBase = kind === 'source' && cleanSourceName ? `${cleanSourceName}.${cleanName}` : cleanName;
	return {
		uniqueId: firstText(uniqueId),
		kind,
		resourceType: firstText(resourceType) || kind,
		name: cleanName,
		dbtName: firstText(dbtName, cleanName),
		sourceName: cleanSourceName,
		packageName: firstText(packageName),
		schema: firstText(schema),
		database: firstText(database),
		pathQualifier: firstText(pathQualifier),
		baseName: firstText(baseName, defaultBase),
		displayName: firstText(baseName, defaultBase),
		groups: buildGroupKeys({ kind, resourceType, name, dbtName, sourceName, baseName, schema, pathQualifier, node }),
		node,
		columns: [],
		columnsByKey: new Map(),
	};
}

export function ensureColumn(entry, name) {
	const cleanName = firstText(name);
	if (!cleanName) return null;
	const key = cleanName.toLowerCase();
	let col = entry.columnsByKey.get(key);
	if (!col) {
		col = { name: cleanName, type: '', pk: false, nn: false, unique: false };
		entry.columns.push(col);
		entry.columnsByKey.set(key, col);
	}
	return col;
}

export function setColumnType(entry, name, type, { override = false } = {}) {
	const col = ensureColumn(entry, name);
	if (!col) return;
	const cleanType = firstText(type);
	if (cleanType && (override || !col.type)) col.type = cleanType;
}

export function addColumnsFromMap(entry, columns, { override = false } = {}) {
	if (!columns || typeof columns !== 'object') return;
	for (const [key, col] of Object.entries(columns)) {
		const name = firstText(col?.name, key);
		if (!name) continue;
		ensureColumn(entry, name);
		setColumnType(entry, name, firstText(col?.data_type, col?.type, col?.dtype), { override });
	}
}

export function applyPkFlags(entries) {
	for (const entry of entries) {
		for (const col of entry.columns) {
			if (col.unique && col.nn) col.pk = true;
		}
	}
}

export function assignDisplayNames(entries) {
	for (const entry of entries) entry.displayName = entry.baseName;
	for (let level = 1; level <= 4; level++) {
		const colliding = collidingEntries(entries);
		if (!colliding.length) return;
		for (const entry of colliding) entry.displayName = qualifiedName(entry, level);
	}
	const stillColliding = collidingEntries(entries);
	for (const entry of stillColliding) {
		entry.displayName = `${entry.displayName}.${safePart(entry.uniqueId).replaceAll('.', '_')}`;
	}
}

function collidingEntries(entries) {
	const counts = new Map();
	for (const entry of entries) {
		const key = entry.displayName.toLowerCase();
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	return entries.filter((entry) => counts.get(entry.displayName.toLowerCase()) > 1);
}

function qualifiedName(entry, level) {
	const tail = entry.kind === 'source' && entry.sourceName ? [entry.sourceName, entry.name] : [entry.name];
	const prefix = [];
	if (level >= 1) {
		const qualifier = firstText(entry.schema, entry.pathQualifier);
		if (qualifier) prefix.push(qualifier);
	}
	if (level >= 2 && entry.packageName) prefix.unshift(entry.packageName);
	if (level >= 3 && entry.database) prefix.unshift(entry.database);
	if (level >= 4 && entry.uniqueId) prefix.push(entry.uniqueId.split('.').slice(-2, -1)[0] || entry.uniqueId);
	return [...prefix, ...tail]
		.map(safePart)
		.filter(Boolean)
		.filter((part, index, parts) => parts.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === index)
		.join('.') || entry.baseName;
}

function safePart(value) {
	return firstText(value).replace(/[\\/]+/g, '.').replace(/^\.+|\.+$/g, '');
}

export function createResolver(entries) {
	const byUid = new Map(entries.map((entry) => [entry.uniqueId, entry]));
	function resolveRef(name, packageName = '') {
		const cleanName = firstText(name).toLowerCase();
		if (!cleanName) return null;
		let matches = entries.filter((entry) => {
			if (entry.kind === 'source') return false;
			return entry.dbtName.toLowerCase() === cleanName;
		});
		const cleanPackage = firstText(packageName).toLowerCase();
		if (cleanPackage) matches = matches.filter((entry) => entry.packageName.toLowerCase() === cleanPackage);
		return matches.length === 1 ? matches[0] : null;
	}
	function resolveSource(sourceName, tableName) {
		const cleanSource = firstText(sourceName).toLowerCase();
		const cleanTable = firstText(tableName).toLowerCase();
		if (!cleanSource || !cleanTable) return null;
		const matches = entries.filter((entry) => {
			return entry.kind === 'source'
				&& entry.sourceName.toLowerCase() === cleanSource
				&& entry.dbtName.toLowerCase() === cleanTable;
		});
		return matches.length === 1 ? matches[0] : null;
	}
	function resolveRelationLeaf(leaf) {
		const cleanLeaf = relationLeaf(leaf).toLowerCase();
		if (!cleanLeaf) return null;
		const matches = entries.filter((entry) => {
			const names = [
				entry.dbtName,
				entry.name,
				relationLeaf(entry.node?.relation_name),
			];
			return names.some((name) => firstText(name).toLowerCase() === cleanLeaf);
		});
		return matches.length === 1 ? matches[0] : null;
	}
	function resolveRelation(rawRelation, rawLeaf = '') {
		const parts = normalizeRelation(rawRelation).split('.').filter(Boolean);
		const qualifierAt = (entry, pos) => pos === 1
			? firstText(entry?.schema).toLowerCase()
			: pos === 2 ? firstText(entry?.database).toLowerCase() : '';
		for (let take = parts.length; take >= 1; take--) {
			const needle = parts.slice(parts.length - take).join('.');
			const matches = entries.filter((entry) => {
				if (!relationCandidates(entry).has(needle)) return false;
				for (let pos = take; pos < parts.length; pos++) {
					const rawPart = parts[parts.length - 1 - pos];
					const entryPart = qualifierAt(entry, pos);
					if (rawPart && entryPart && entryPart !== rawPart) return false;
				}
				return true;
			});
			if (matches.length === 1) return matches[0];
		}
		return parts.length > 1 ? null : resolveRelationLeaf(rawLeaf || parts[0] || '');
	}
	function fromCall(call) {
		if (!call) return null;
		if (call.type === 'ref') return resolveRef(call.name, call.packageName);
		if (call.type === 'source') return resolveSource(call.sourceName, call.name);
		return null;
	}
	return { byUid, resolveRef, resolveSource, resolveRelationLeaf, resolveRelation, fromCall };
}

export function parseDbtCall(value) {
	const text = firstText(value);
	if (!text) return null;
	const sourceMatch = text.match(/\bsource\s*\(([\s\S]*?)\)/);
	if (sourceMatch) {
		const args = quotedArgs(sourceMatch[1]);
		if (args.length >= 2) return { type: 'source', sourceName: args[0], name: args[1] };
	}
	const refMatch = text.match(/\bref\s*\(([\s\S]*?)\)/);
	if (refMatch) {
		const args = quotedArgs(refMatch[1]);
		if (args.length >= 2) return { type: 'ref', packageName: args[0], name: args[1] };
		if (args.length === 1) return { type: 'ref', packageName: '', name: args[0] };
	}
	return null;
}

export function parseDbtCalls(text) {
	const calls = [];
	const re = /\b(ref|source)\s*\(([^)]*)\)/g;
	let match;
	while ((match = re.exec(text)) !== null) {
		const call = parseDbtCall(`${match[1]}(${match[2]})`);
		if (call) calls.push(call);
	}
	return calls;
}

function quotedArgs(text) {
	const out = [];
	const re = /(['"])([\s\S]*?)\1/g;
	let match;
	while ((match = re.exec(text)) !== null) out.push(match[2].trim());
	return out;
}

export function fallbackNameForCall(call) {
	if (!call) return '';
	if (call.type === 'source') return `${call.sourceName}.${call.name}`;
	return call.name;
}

export function applyEntryConstraintFlags(entry) {
	applyConstraintFlags(entry, entry?.node?.constraints);
	for (const [key, col] of Object.entries(entry?.node?.columns ?? {})) {
		const columnName = firstText(col?.name, key);
		applyConstraintFlags(entry, col?.constraints, { columnName });
	}
}

export function entryConstraintRelations(entry, resolver) {
	const rels = [];
	rels.push(...constraintRelations(entry, entry?.node?.constraints, resolver));
	for (const [key, col] of Object.entries(entry?.node?.columns ?? {})) {
		const columnName = firstText(col?.name, key);
		rels.push(...constraintRelations(entry, col?.constraints, resolver, { columnName }));
	}
	return rels;
}

export function parseConstraintTarget(constraint) {
	const targetTexts = [constraint?.to, constraint?.expression, constraint?.references]
		.map((value) => firstText(value))
		.filter(Boolean);
	const call = targetTexts.map((text) => parseDbtCall(text)).find(Boolean) || null;
	const explicitToColumns = stringList(constraint?.to_columns);
	if (call) return { call, rawLeaf: '', rawRelation: '', toColumns: explicitToColumns };
	const raw = firstText(...targetTexts);
	const rawTarget = parseRawConstraintTarget(raw);
	return {
		call: null,
		rawLeaf: rawTarget.rawLeaf,
		rawRelation: rawTarget.rawRelation,
		toColumns: explicitToColumns.length ? explicitToColumns : rawTarget.toColumns,
	};
}

function applyConstraintFlags(entry, constraints, { columnName = '' } = {}) {
	for (const constraint of array(constraints)) {
		if (!constraint || typeof constraint !== 'object') continue;
		const type = normalizeConstraintType(constraint?.type);
		const columns = constraintColumns(constraint, columnName);
		const singleColumnUnique = type === 'unique' && columns.length === 1;
		if (!columns.length) continue;
		for (const name of columns) {
			const col = ensureColumn(entry, name);
			if (!col) continue;
			if (type === 'primary_key') {
				col.pk = true;
				col.nn = true;
			} else if (type === 'not_null') {
				col.nn = true;
			} else if (singleColumnUnique) {
				col.unique = true;
			}
		}
	}
}

function constraintRelations(entry, constraints, resolver, { columnName = '' } = {}) {
	const rels = [];
	for (const constraint of array(constraints)) {
		if (!constraint || typeof constraint !== 'object') continue;
		if (normalizeConstraintType(constraint?.type) !== 'foreign_key') continue;
		const fromCols = constraintColumns(constraint, columnName);
		if (!fromCols.length) continue;
		const target = parseConstraintTarget(constraint);
		const targetEntry = target.call ? resolver.fromCall(target.call) : resolver.resolveRelation(target.rawRelation, target.rawLeaf);
		const toTable = targetEntry?.displayName || fallbackNameForCall(target.call) || target.rawRelation || target.rawLeaf;
		if (!entry?.displayName || !toTable) continue;
		const toCols = target.toColumns.length ? target.toColumns : defaultTargetColumns(targetEntry);
		rels.push({
			fromTable: entry.displayName,
			fromCols,
			toTable,
			toCols,
		});
	}
	return rels;
}

function constraintColumns(constraint, columnName) {
	if (columnName) return [columnName];
	return stringList(constraint?.columns ?? constraint?.column_names ?? constraint?.column_name ?? constraint?.column);
}

function parseRawConstraintTarget(value) {
	let text = firstText(value);
	if (!text) return { rawLeaf: '', rawRelation: '', toColumns: [] };
	const references = text.match(/\breferences\s+([\s\S]*)/i);
	if (references) text = references[1];
	text = text.replace(/\s+\b(on\s+(delete|update)|deferrable|not\s+deferrable)\b[\s\S]*$/i, '').trim();
	const columns = text.match(/\(([^()]*)\)\s*$/);
	let toColumns = [];
	if (columns) {
		toColumns = stringList(columns[1]);
		text = text.slice(0, columns.index).trim();
	}
	return { rawLeaf: relationLeaf(text), rawRelation: normalizeRelation(text), toColumns };
}

function defaultTargetColumns(entry) {
	if (!entry) return [];
	const pks = entry.columns.filter((col) => col.pk).map((col) => col.name);
	if (pks.length) return pks;
	const first = entry.columns[0]?.name;
	return first ? [first] : [];
}

function normalizeConstraintType(value) {
	return firstText(value).toLowerCase().replace(/[\s-]+/g, '_');
}

function stringList(value) {
	const values = Array.isArray(value) ? value : [value];
	return values.flatMap((item) => {
		const text = firstText(item);
		if (!text) return [];
		return text.split(',').map(stripIdentifier).filter(Boolean);
	});
}

function stripIdentifier(value) {
	return firstText(value).trim().replace(/^[`"'\[]+|[`"'\]]+$/g, '');
}

function relationLeaf(value) {
	const text = firstText(value).replace(/[;]+$/g, '').trim();
	if (!text) return '';
	const relation = text.split(/\s+/)[0];
	return stripIdentifier(relation.split('.').filter(Boolean).pop());
}

function relationCandidates(entry) {
	const out = new Set();
	const db = firstText(entry?.database).toLowerCase();
	const schema = firstText(entry?.schema).toLowerCase();
	for (const name of [firstText(entry?.dbtName).toLowerCase(), firstText(entry?.name).toLowerCase()]) {
		if (!name) continue;
		out.add(name);
		if (schema) out.add(`${schema}.${name}`);
		if (schema && db) out.add(`${db}.${schema}.${name}`);
	}
	const disp = firstText(entry?.displayName).toLowerCase();
	if (disp) out.add(disp);
	const rel = normalizeRelation(entry?.node?.relation_name);
	if (rel) {
		const relParts = rel.split('.');
		out.add(rel);
		out.add(relParts[relParts.length - 1]);
		if (relParts.length >= 2) out.add(relParts.slice(-2).join('.'));
	}
	return out;
}

function normalizeRelation(value) {
	const head = firstText(value).replace(/[;]+$/g, '').split(/\s+/)[0];
	if (!head) return '';
	return head.split('.').map(stripIdentifier).filter(Boolean).join('.').toLowerCase();
}

function array(value) {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}

export function finalizeEntries(entries, rels) {
	const tables = entries.map((entry) => {
		const table = makeTable(entry.displayName);
		for (const col of entry.columns) addColumn(table, col);
		table.groups = entry.groups || {};
		return table;
	});
	const model = finalize(tables, rels);
	const stats = {
		tables: model.tables.length,
		relations: model.relations.length,
		columns: model.tables.reduce((sum, table) => sum + table.columns.length, 0),
	};
	return { model, stats };
}
