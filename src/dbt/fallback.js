import fs from 'node:fs';
import path from 'node:path';
import {
	addColumnsFromMap,
	applyPkFlags,
	applyEntryConstraintFlags,
	assignDisplayNames,
	createEntry,
	createResolver,
	ensureColumn,
	fallbackNameForCall,
	entryConstraintRelations,
	finalizeEntries,
	firstText,
	getModelPaths,
	getSeedPaths,
	getSnapshotPaths,
	isDisabled,
	isSkippedWarehouseObject,
	normalizeTestName,
	parseDbtCall,
	parseDbtCalls,
	readYamlFile,
	walkFiles,
} from './common.js';

export function mapFallback(projectDir, projectConfig, project, { lineage = false } = {}) {
	const entries = [];
	const relationSpecs = [];
	const modelEntriesByName = new Map();
	const excludedModels = new Set();
	const modelRoots = getModelPaths(projectConfig).map((modelPath) => resolveProjectPath(projectDir, modelPath));
	const seedRoots = getSeedPaths(projectConfig).map((seedPath) => resolveProjectPath(projectDir, seedPath));
	const snapshotRoots = getSnapshotPaths(projectConfig).map((snapshotPath) => resolveProjectPath(projectDir, snapshotPath));
	const yamlRoots = uniqueFiles([...modelRoots, ...seedRoots, ...snapshotRoots]);
	const yamlFiles = uniqueFiles(yamlRoots.flatMap((root) => walkFiles(root, (_, name) => /\.ya?ml$/i.test(name))));
	for (const file of yamlFiles) {
		collectYamlFile(projectDir, project, file, entries, modelEntriesByName, excludedModels, relationSpecs);
	}
	const modelSqlFiles = uniqueFiles(modelRoots.flatMap((root) => walkFiles(root, (_, name) => /\.sql$/i.test(name))));
	const modelRecords = collectSqlModels(projectDir, project, modelSqlFiles, entries, modelEntriesByName, excludedModels);
	const seedFiles = uniqueFiles(seedRoots.flatMap((root) => walkFiles(root, (_, name) => /\.csv$/i.test(name))));
	collectSeedFiles(projectDir, project, seedFiles, entries, modelEntriesByName, excludedModels);
	const snapshotFiles = uniqueFiles(snapshotRoots.flatMap((root) => walkFiles(root, (_, name) => /\.sql$/i.test(name))));
	const snapshotRecords = collectSnapshotFiles(projectDir, project, snapshotFiles, entries, modelEntriesByName, excludedModels);
	const sqlRecords = [...modelRecords, ...snapshotRecords];
	assignDisplayNames(entries);
	const resolver = createResolver(entries);
	if (!lineage) {
		for (const entry of entries) applyEntryConstraintFlags(entry);
	}
	applyPkFlags(entries);
	const constraintRels = lineage ? [] : collectYamlConstraintRelations(entries, resolver);
	const rels = lineage
		? collectSqlLineage(sqlRecords, resolver)
		: [...materializeYamlRelations(relationSpecs, resolver), ...constraintRels];
	const { model, stats } = finalizeEntries(entries, rels);
	return { model, project, source: 'yml', mode: lineage ? 'lineage' : 'erd', stats };
}

function collectYamlFile(projectDir, project, file, entries, modelEntriesByName, excludedModels, relationSpecs) {
	const doc = readYamlFile(file);
	const relativeFile = path.relative(projectDir, file);
	collectYamlTableEntries(project, relativeFile, doc?.models, 'model', entries, modelEntriesByName, excludedModels, relationSpecs);
	collectYamlTableEntries(project, relativeFile, doc?.seeds, 'seed', entries, modelEntriesByName, excludedModels, relationSpecs);
	collectYamlTableEntries(project, relativeFile, doc?.snapshots, 'snapshot', entries, modelEntriesByName, excludedModels, relationSpecs);
	for (const [sourceIndex, source] of array(doc?.sources).entries()) {
		if (isDisabled(source)) continue;
		const sourceName = firstText(source?.name);
		if (!sourceName) continue;
		for (const [tableIndex, table] of array(source?.tables).entries()) {
			if (isDisabled(table)) continue;
			const tableName = firstText(table?.name);
			if (!tableName) continue;
			const entry = createEntry({
				uniqueId: `source.yml:${relativeFile}:${sourceIndex}:${tableIndex}:${sourceName}.${tableName}`,
				kind: 'source',
				resourceType: 'source',
				name: tableName,
				sourceName,
				packageName: project,
				schema: firstText(table?.schema, source?.schema),
				pathQualifier: path.dirname(relativeFile) === '.' ? '' : path.dirname(relativeFile),
				node: table,
			});
			addYamlColumns(entry, table?.columns, relationSpecs);
			collectYamlTests(entry, table, '', relationSpecs);
			entries.push(entry);
		}
	}
}

function collectYamlTableEntries(project, relativeFile, objects, kind, entries, modelEntriesByName, excludedModels, relationSpecs) {
	for (const [index, object] of array(objects).entries()) {
		const name = firstText(object?.name);
		if (!name) continue;
		if (isSkippedWarehouseObject(object)) {
			excludedModels.add(exclusionKey(kind, name));
			continue;
		}
		const entry = createEntry({
			uniqueId: `${kind}.yml:${relativeFile}:${index}:${name}`,
			kind,
			resourceType: kind,
			name,
			packageName: project,
			schema: firstText(object?.schema, object?.config?.schema),
			pathQualifier: path.dirname(relativeFile) === '.' ? '' : path.dirname(relativeFile),
			node: object,
		});
		addYamlColumns(entry, object?.columns, relationSpecs);
		collectYamlTests(entry, object, '', relationSpecs);
		entries.push(entry);
		registerModel(modelEntriesByName, entry);
	}
}

function collectSqlModels(projectDir, project, sqlFiles, entries, modelEntriesByName, excludedModels) {
	const records = [];
	for (const file of sqlFiles) {
		const name = path.basename(file, path.extname(file));
		if (isExcluded(excludedModels, 'model', name)) continue;
		let entry = firstModelEntry(modelEntriesByName, 'model', name);
		if (!entry) {
			const relativeFile = path.relative(projectDir, file);
			entry = createEntry({
				uniqueId: `model.sql:${relativeFile}`,
				kind: 'model',
				resourceType: 'model',
				name,
				packageName: project,
				pathQualifier: path.dirname(relativeFile) === '.' ? '' : path.dirname(relativeFile),
			});
			entries.push(entry);
			registerModel(modelEntriesByName, entry);
		}
		records.push({ file, entry });
	}
	return records;
}

function collectSeedFiles(projectDir, project, seedFiles, entries, modelEntriesByName, excludedModels) {
	for (const file of seedFiles) {
		const name = path.basename(file, path.extname(file));
		if (isExcluded(excludedModels, 'seed', name)) continue;
		let entry = firstModelEntry(modelEntriesByName, 'seed', name);
		if (!entry) {
			const relativeFile = path.relative(projectDir, file);
			entry = createEntry({
				uniqueId: `seed.csv:${relativeFile}`,
				kind: 'seed',
				resourceType: 'seed',
				name,
				packageName: project,
				pathQualifier: path.dirname(relativeFile) === '.' ? '' : path.dirname(relativeFile),
			});
			entries.push(entry);
			registerModel(modelEntriesByName, entry);
		}
		addCsvHeaderColumns(entry, file);
	}
}

function collectSnapshotFiles(projectDir, project, snapshotFiles, entries, modelEntriesByName, excludedModels) {
	const records = [];
	for (const file of snapshotFiles) {
		const sql = readTextFile(file);
		const name = firstText(snapshotNameFromSql(sql), path.basename(file, path.extname(file)));
		if (isExcluded(excludedModels, 'snapshot', name)) continue;
		let entry = firstModelEntry(modelEntriesByName, 'snapshot', name);
		if (!entry) {
			const relativeFile = path.relative(projectDir, file);
			entry = createEntry({
				uniqueId: `snapshot.sql:${relativeFile}`,
				kind: 'snapshot',
				resourceType: 'snapshot',
				name,
				packageName: project,
				pathQualifier: path.dirname(relativeFile) === '.' ? '' : path.dirname(relativeFile),
			});
			entries.push(entry);
			registerModel(modelEntriesByName, entry);
		}
		records.push({ file, entry });
	}
	return records;
}

function addYamlColumns(entry, columns, relationSpecs) {
	for (const col of array(columns)) {
		const name = firstText(col?.name);
		if (!name) continue;
		ensureColumn(entry, name);
		addColumnsFromMap(entry, { [name]: col });
		collectYamlTests(entry, col, name, relationSpecs);
	}
}

function collectYamlTests(entry, owner, columnName, relationSpecs) {
	for (const item of [...array(owner?.tests), ...array(owner?.data_tests)]) {
		const test = parseYamlTest(item);
		if (!test.name) continue;
		if (test.name === 'unique' || test.name === 'not_null') {
			const col = ensureColumn(entry, firstText(columnName, test.args.column_name, test.args.column));
			if (col && test.name === 'unique') col.unique = true;
			if (col && test.name === 'not_null') col.nn = true;
		} else if (test.name === 'relationships') {
			const fromCol = firstText(columnName, test.args.column_name, test.args.column);
			const to = firstText(test.args.to, test.args.model);
			if (fromCol && to) {
				relationSpecs.push({
					fromEntry: entry,
					fromCol,
					to,
					field: firstText(test.args.field, test.args.to_field),
				});
			}
		}
	}
}

function parseYamlTest(item) {
	if (typeof item === 'string') return { name: normalizeTestName(item), args: {} };
	if (!item || typeof item !== 'object') return { name: '', args: {} };
	const [[rawName, rawArgs] = []] = Object.entries(item);
	if (!rawName) return { name: '', args: {} };
	const args = rawArgs && typeof rawArgs === 'object' ? { ...rawArgs } : {};
	if (args.arguments && typeof args.arguments === 'object') Object.assign(args, args.arguments);
	return { name: normalizeTestName(rawName), args };
}

function materializeYamlRelations(relationSpecs, resolver) {
	const rels = [];
	for (const spec of relationSpecs) {
		const call = parseDbtCall(spec.to);
		const target = resolver.fromCall(call);
		const toTable = target?.displayName || fallbackNameForCall(call) || firstText(spec.to);
		if (!spec.fromEntry.displayName || !toTable) continue;
		rels.push({
			fromTable: spec.fromEntry.displayName,
			fromCols: [spec.fromCol],
			toTable,
			toCols: spec.field ? [spec.field] : [],
		});
	}
	return rels;
}

function collectYamlConstraintRelations(entries, resolver) {
	return entries.flatMap((entry) => entryConstraintRelations(entry, resolver));
}

function collectSqlLineage(sqlRecords, resolver) {
	const rels = [];
	for (const { file, entry } of sqlRecords) {
		const sql = readTextFile(file);
		for (const call of parseDbtCalls(sql)) {
			const target = resolver.fromCall(call);
			const fromTable = target?.displayName || fallbackNameForCall(call);
			if (fromTable) rels.push({ fromTable, fromCols: [], toTable: entry.displayName, toCols: [] });
		}
	}
	return rels;
}

function registerModel(modelEntriesByName, entry) {
	const key = entry.name.toLowerCase();
	const entries = modelEntriesByName.get(key) ?? [];
	entries.push(entry);
	modelEntriesByName.set(key, entries);
}

function firstModelEntry(modelEntriesByName, kind, name) {
	const key = firstText(name).toLowerCase();
	const entries = (modelEntriesByName.get(key) ?? []).filter((entry) => entry.kind === kind);
	return entries.length === 1 ? entries[0] : null;
}

function addCsvHeaderColumns(entry, file) {
	for (const name of csvHeaderColumns(file)) ensureColumn(entry, name);
}

function csvHeaderColumns(file) {
	const line = readTextFile(file).split(/\r?\n/).find((candidate) => candidate.trim());
	if (!line) return [];
	const columns = line.split(',').map(stripCsvHeaderCell).filter(Boolean);
	return columns.length ? columns : [];
}

function stripCsvHeaderCell(value) {
	return firstText(value).replace(/^\uFEFF/, '');
}

function snapshotNameFromSql(sql) {
	const match = firstText(sql).match(/\{%-?\s*snapshot\s+([^\s%}]+)\s*-?%\}/i);
	return firstText(match?.[1]);
}

function readTextFile(file) {
	try {
		return fs.readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

function isExcluded(excludedModels, kind, name) {
	return excludedModels.has(exclusionKey(kind, name));
}

function exclusionKey(kind, name) {
	return `${kind}:${firstText(name).toLowerCase()}`;
}

function resolveProjectPath(projectDir, targetPath) {
	return path.isAbsolute(targetPath) ? targetPath : path.join(projectDir, targetPath);
}

function uniqueFiles(files) {
	return [...new Set(files)].sort();
}

function array(value) {
	if (!value) return [];
	return Array.isArray(value) ? value : [value];
}
