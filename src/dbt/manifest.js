import fs from 'node:fs';
import path from 'node:path';
import {
	TABLE_RESOURCE_TYPES,
	addColumnsFromMap,
	applyPkFlags,
	applyEntryConstraintFlags,
	assignDisplayNames,
	cleanScalar,
	createEntry,
	createResolver,
	ensureColumn,
	fallbackNameForCall,
	entryConstraintRelations,
	finalizeEntries,
	firstText,
	isDisabled,
	isSkippedWarehouseObject,
	normalizeTestName,
	parseDbtCall,
	readJsonFile,
} from './common.js';

export function mapArtifacts(projectDir, project, { lineage = false } = {}) {
	const manifest = readJsonFile(path.join(projectDir, 'target', 'manifest.json'));
	const catalogPath = path.join(projectDir, 'target', 'catalog.json');
	const catalog = fs.existsSync(catalogPath) ? readJsonFile(catalogPath) : {};
	const entries = collectArtifactEntries(manifest, catalog);
	assignDisplayNames(entries);
	const resolver = createResolver(entries);
	const fkRels = collectArtifactTests(manifest, resolver);
	if (!lineage) {
		for (const entry of entries) applyEntryConstraintFlags(entry);
	}
	applyPkFlags(entries);
	if (!lineage) fkRels.push(...collectArtifactConstraints(entries, resolver));
	const rels = lineage ? collectLineageRelations(entries, resolver) : fkRels;
	const { model, stats } = finalizeEntries(entries, rels);
	return { model, project, source: 'manifest', mode: lineage ? 'lineage' : 'erd', stats };
}

function collectArtifactEntries(manifest, catalog) {
	const entries = [];
	for (const [manifestKey, node] of Object.entries(manifest?.nodes ?? {})) {
		const resourceType = firstText(node?.resource_type);
		if (!TABLE_RESOURCE_TYPES.has(resourceType) || isSkippedWarehouseObject(node)) continue;
		const uniqueId = firstText(node?.unique_id, manifestKey);
		const entry = createEntry({
			uniqueId,
			kind: 'model',
			resourceType,
			name: artifactModelDisplayName(node, uniqueId),
			dbtName: firstText(node?.name, uniqueId.split('.').pop()),
			packageName: node?.package_name,
			schema: node?.schema,
			database: node?.database,
			node,
		});
		addColumnsFromMap(entry, node?.columns);
		entries.push(entry);
	}
	for (const [manifestKey, source] of Object.entries(manifest?.sources ?? {})) {
		if (isDisabled(source)) continue;
		const uniqueId = firstText(source?.unique_id, manifestKey);
		const entry = createEntry({
			uniqueId,
			kind: 'source',
			resourceType: 'source',
			name: artifactSourceDisplayName(source, uniqueId),
			dbtName: firstText(source?.name, uniqueId.split('.').pop()),
			sourceName: firstText(source?.source_name, uniqueId.split('.').slice(-2, -1)[0]),
			packageName: source?.package_name,
			schema: source?.schema,
			database: source?.database,
			node: source,
		});
		addColumnsFromMap(entry, source?.columns);
		entries.push(entry);
	}
	for (const entry of entries) {
		const catalogBucket = entry.kind === 'source' ? catalog?.sources : catalog?.nodes;
		addColumnsFromMap(entry, catalogBucket?.[entry.uniqueId]?.columns, { override: true });
	}
	return entries;
}

function artifactModelDisplayName(node, uniqueId) {
	return firstText(node?.alias, node?.identifier, relationNameLeaf(node?.relation_name), node?.name, uniqueId.split('.').pop());
}

function artifactSourceDisplayName(source, uniqueId) {
	return firstText(source?.identifier, relationNameLeaf(source?.relation_name), source?.name, uniqueId.split('.').pop());
}

function relationNameLeaf(value) {
	const relationName = firstText(value);
	if (!relationName) return '';
	return relationName.split('.').map((part) => part.trim().replace(/^[`"'\[]+|[`"'\]]+$/g, '')).filter(Boolean).pop() || '';
}

function collectArtifactTests(manifest, resolver) {
	const rels = [];
	for (const test of Object.values(manifest?.nodes ?? {})) {
		if (firstText(test?.resource_type) !== 'test' || isDisabled(test)) continue;
		const testName = normalizeTestName(test?.test_metadata?.name);
		if (!testName) continue;
		if (testName === 'unique' || testName === 'not_null') {
			const colName = artifactTestColumn(test);
			const ownerUid = resolveArtifactOwner(test, resolver, colName);
			const entry = resolver.byUid.get(ownerUid);
			const col = entry ? ensureColumn(entry, colName) : null;
			if (col && testName === 'unique') col.unique = true;
			if (col && testName === 'not_null') col.nn = true;
		} else if (testName === 'relationships') {
			const rel = artifactRelationship(test, resolver);
			if (rel) rels.push(rel);
		}
	}
	return rels;
}

function artifactRelationship(test, resolver) {
	const kwargs = testKwargs(test);
	const fromCol = artifactTestColumn(test);
	if (!fromCol) return null;
	const targetCall = parseDbtCall(kwargs?.to);
	let targetEntry = resolver.fromCall(targetCall);
	const targetUid = targetEntry?.uniqueId;
	const fromUid = resolveArtifactOwner(test, resolver, fromCol, targetUid);
	const fromEntry = resolver.byUid.get(fromUid);
	if (!fromEntry) return null;
	if (!targetEntry) {
		const otherUid = artifactDeps(test, resolver).find((uid) => uid !== fromUid);
		targetEntry = resolver.byUid.get(otherUid);
	}
	const toTable = targetEntry?.displayName || fallbackNameForCall(targetCall) || cleanScalar(kwargs?.to);
	if (!toTable) return null;
	return {
		fromTable: fromEntry.displayName,
		fromCols: [fromCol],
		toTable,
		toCols: firstText(kwargs?.field) ? [firstText(kwargs.field)] : [],
	};
}

function artifactTestColumn(test) {
	const kwargs = testKwargs(test);
	return firstText(test?.column_name, kwargs?.column_name, kwargs?.column);
}

function testKwargs(test) {
	const raw = test?.test_metadata?.kwargs;
	if (!raw || typeof raw !== 'object') return {};
	return raw.arguments && typeof raw.arguments === 'object' ? { ...raw, ...raw.arguments } : raw;
}

function resolveArtifactOwner(test, resolver, colName, excludedUid = '') {
	const attached = firstText(test?.attached_node);
	if (attached && resolver.byUid.has(attached) && attached !== excludedUid) return attached;
	const deps = artifactDeps(test, resolver);
	const colKey = firstText(colName).toLowerCase();
	if (colKey) {
		const byColumn = deps.find((uid) => uid !== excludedUid && resolver.byUid.get(uid)?.columnsByKey?.has(colKey));
		if (byColumn) return byColumn;
	}
	return deps.find((uid) => uid !== excludedUid) || deps[0] || '';
}

function artifactDeps(test, resolver) {
	return (test?.depends_on?.nodes ?? []).filter((uid) => resolver.byUid.has(uid));
}

function collectArtifactConstraints(entries, resolver) {
	return entries.flatMap((entry) => entryConstraintRelations(entry, resolver));
}

function collectLineageRelations(entries, resolver) {
	const rels = [];
	for (const entry of entries) {
		if (entry.kind === 'source' || !TABLE_RESOURCE_TYPES.has(entry.resourceType)) continue;
		for (const depUid of entry.node?.depends_on?.nodes ?? []) {
			const dep = resolver.byUid.get(depUid);
			if (!dep || (dep.kind !== 'source' && !TABLE_RESOURCE_TYPES.has(dep.resourceType))) continue;
			rels.push({ fromTable: dep.displayName, fromCols: [], toTable: entry.displayName, toCols: [] });
		}
	}
	return rels;
}
