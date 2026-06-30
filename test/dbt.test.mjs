import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDbtProjects, isDbtProject, mapDbtProject } from '../src/dbt/index.js';
import { buildGroupKeys } from '../src/dbt/common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');
const artifactsDir = path.join(fixturesDir, 'jaffle_artifacts');
const ymlDir = path.join(fixturesDir, 'jaffle_yml');

describe('dbt project detection', () => {
	test('detects dbt projects recursively while skipping build/vendor dirs', () => {
		assert.equal(isDbtProject(artifactsDir), true);
		assert.equal(isDbtProject(fixturesDir), false);
		const projects = findDbtProjects(fixturesDir).map((project) => path.basename(project)).sort();
		assert.deepEqual(projects, ['jaffle_artifacts', 'jaffle_yml']);
	});

	test('rejects non-dbt project directories clearly', async () => {
		await assert.rejects(() => mapDbtProject(fixturesDir), /Not a dbt project: .*missing dbt_project\.yml/);
	});
});

describe('dbt group keys', () => {
	test('derives domain/layer/folder from dbt metadata', () => {
		const stg = buildGroupKeys({ pathQualifier: 'models/staging/stripe', name: 'stg_orders', dbtName: 'stg_orders' });
		assert.equal(stg.domain, 'orders');
		assert.equal(stg.layer, 'staging');
		assert.equal(stg.folder, 'staging/stripe');

		const mart = buildGroupKeys({ node: { original_file_path: 'models/marts/dim_x.sql' }, name: 'dim_x', dbtName: 'dim_x' });
		assert.equal(mart.layer, 'marts');
		assert.equal(mart.folder, 'marts');
	});

	test('strips layer prefixes to the business-domain token', () => {
		assert.equal(buildGroupKeys({ name: 'stg_gosilico_calibration_x', dbtName: 'stg_gosilico_calibration_x' }).domain, 'gosilico');
		// name-prefix layer fallback when there is no folder
		assert.equal(buildGroupKeys({ name: 'stg_orders', dbtName: 'stg_orders' }).layer, 'staging');
	});

	test('kind wins for sources; source domain comes from the source name; schema lowercased', () => {
		const src = buildGroupKeys({ kind: 'source', resourceType: 'source', sourceName: 'Stripe', name: 'orders', dbtName: 'orders' });
		assert.equal(src.layer, 'source');
		assert.equal(src.domain, 'stripe');
		assert.equal(buildGroupKeys({ schema: 'Analytics', name: 'orders', dbtName: 'orders' }).schema, 'analytics');
	});
});

describe('dbt artifact mapper', () => {
	test('maps manifest/catalog tables, columns, keys, relationships, and duplicate names', async () => {
		const result = await mapDbtProject(artifactsDir);
		assert.equal(result.project, 'jaffle_artifacts');
		assert.equal(result.source, 'manifest');
		assert.equal(result.mode, 'erd');
		assert.deepEqual(tableNames(result.model), [
			'analytics.orders',
			'contract_orders',
			'customers',
			'dim_region',
			'fct_sales',
			'marketing.orders',
			'order_items',
			'products',
			'raw.customers',
			'raw.orders',
		]);
		assertShape(result.model);
		assertStats(result);

		const customers = table(result.model, 'customers');
		assert.equal(column(customers, 'id').type, 'integer');
		assert.deepEqual(pickFlags(column(customers, 'id')), { pk: true, nn: true, unique: true, fk: false });
		assert.equal(column(customers, 'first_name').type, 'text');

		const orders = table(result.model, 'analytics.orders');
		assert.equal(column(orders, 'customer_id').type, 'integer');
		assert.deepEqual(pickFlags(column(orders, 'id')), { pk: true, nn: true, unique: true, fk: false });
		assert.equal(column(orders, 'customer_id').fk, true);

		const orderTables = result.model.tables.filter((candidate) => candidate.name.endsWith('.orders'));
		assert.equal(orderTables.length, 3);
		assert.equal(new Set(orderTables.map((candidate) => candidate.key)).size, 3);
		assert.ok(orderTables.some((candidate) => candidate.name === 'analytics.orders'));
		assert.ok(orderTables.some((candidate) => candidate.name === 'marketing.orders'));
		assert.ok(orderTables.some((candidate) => candidate.name === 'raw.orders'));

		assertRelation(result.model, 'analytics.orders', ['customer_id'], 'customers', ['id']);
		assertRelation(result.model, 'order_items', ['order_id'], 'analytics.orders', ['id']);
		assertRelation(result.model, 'order_items', ['product_id'], 'products', ['id']);
		assertRelation(result.model, 'raw.orders', ['customer_id'], 'customers', ['id']);
		assert.ok(result.model.relations.length >= 2);
	});

	test('maps manifest model-contract constraints into ERD keys and FKs', async () => {
		const result = await mapDbtProject(artifactsDir);
		const contract = table(result.model, 'contract_orders');
		assert.equal(column(contract, 'id').type, 'integer');
		assert.deepEqual(pickFlags(column(contract, 'id')), { pk: true, nn: true, unique: false, fk: false });
		assert.deepEqual(pickFlags(column(contract, 'order_id')), { pk: false, nn: false, unique: false, fk: true });
		assert.deepEqual(pickFlags(column(contract, 'customer_id')), { pk: false, nn: true, unique: false, fk: true });
		assert.deepEqual(pickFlags(column(contract, 'product_id')), { pk: false, nn: true, unique: false, fk: true });
		assert.equal(column(contract, 'notes').type, 'text');

		assertRelation(result.model, 'contract_orders', ['order_id'], 'analytics.orders', ['id']);
		assertRelation(result.model, 'contract_orders', ['customer_id'], 'customers', ['id']);
		assertRelation(result.model, 'contract_orders', ['product_id'], 'products', ['id']);
		assert.equal(relationCount(result.model, 'contract_orders', ['order_id'], 'analytics.orders', ['id']), 1);
	});

	test('resolves composite and raw-expression foreign-key constraints', async () => {
		const result = await mapDbtProject(artifactsDir);
		const region = table(result.model, 'dim_region');
		assert.equal(column(region, 'country_code').pk, true);
		assert.equal(column(region, 'region_code').pk, true);

		assertRelation(result.model, 'fct_sales', ['country_code', 'region_code'], 'dim_region', ['country_code', 'region_code']);
		assert.equal(relationCount(result.model, 'fct_sales', ['country_code', 'region_code'], 'dim_region', ['country_code', 'region_code']), 1);
		assert.equal(column(table(result.model, 'fct_sales'), 'country_code').fk, true);
		assert.equal(column(table(result.model, 'fct_sales'), 'region_code').fk, true);

		assertRelation(result.model, 'fct_sales', ['order_ref'], 'analytics.orders', ['id']);
	});

	test('maps manifest lineage upstream to downstream', async () => {
		const result = await mapDbtProject(artifactsDir, { lineage: true });
		assert.equal(result.source, 'manifest');
		assert.equal(result.mode, 'lineage');
		assertShape(result.model);
		assertRelation(result.model, 'customers', [], 'analytics.orders', []);
		assertRelation(result.model, 'raw.orders', [], 'analytics.orders', []);
		assertRelation(result.model, 'analytics.orders', [], 'order_items', []);
		assertRelation(result.model, 'products', [], 'order_items', []);
		assert.ok(result.model.relations.every((rel) => rel.fromCols.length === 0 && rel.toCols.length === 0));
	});
});

describe('dbt schema-yml fallback mapper', () => {
	test('maps schema yml tables, columns, tests, source relations, and SQL-only models', async () => {
		const result = await mapDbtProject(ymlDir);
		assert.equal(result.project, 'jaffle_yml');
		assert.equal(result.source, 'yml');
		assert.equal(result.mode, 'erd');
		assert.deepEqual(tableNames(result.model), [
			'contract_orders',
			'country_codes',
			'customer_segments',
			'customers',
			'order_items',
			'order_status_snapshot',
			'orders',
			'products',
			'raw.payments',
		]);
		assert.equal(result.model.tables.some((candidate) => candidate.name === 'ephemeral_rollup'), false);
		assert.equal(result.model.tables.some((candidate) => candidate.name === 'disabled_model'), false);
		assertShape(result.model);
		assertStats(result);

		const customers = table(result.model, 'customers');
		assert.equal(column(customers, 'id').type, 'integer');
		assert.deepEqual(pickFlags(column(customers, 'id')), { pk: true, nn: true, unique: true, fk: false });
		assert.equal(table(result.model, 'customer_segments').columns.length, 0);

		assertRelation(result.model, 'orders', ['customer_id'], 'customers', ['id']);
		assertRelation(result.model, 'order_items', ['order_id'], 'orders', ['id']);
		assertRelation(result.model, 'order_items', ['product_id'], 'products', ['id']);
		assertRelation(result.model, 'raw.payments', ['order_id'], 'orders', ['id']);
	});

	test('maps schema-yml fallback seeds and snapshots from default paths', async () => {
		const result = await mapDbtProject(ymlDir);
		const countryCodes = table(result.model, 'country_codes');
		assert.equal(column(countryCodes, 'customer_id').type, 'integer');
		assert.equal(column(countryCodes, 'country_code').type, 'text');
		assert.equal(column(countryCodes, 'country_name').type, '');
		assert.deepEqual(pickFlags(column(countryCodes, 'customer_id')), { pk: true, nn: true, unique: true, fk: true });

		const snapshot = table(result.model, 'order_status_snapshot');
		assert.equal(column(snapshot, 'id').type, 'integer');
		assert.deepEqual(pickFlags(column(snapshot, 'id')), { pk: true, nn: true, unique: true, fk: false });
		assert.equal(column(snapshot, 'status').type, 'text');

		assertRelation(result.model, 'country_codes', ['customer_id'], 'customers', ['id']);
		assertRelation(result.model, 'order_status_snapshot', ['customer_id'], 'customers', ['id']);
	});

	test('maps schema-yml model-contract constraints into ERD keys and FKs', async () => {
		const result = await mapDbtProject(ymlDir);
		const contract = table(result.model, 'contract_orders');
		assert.equal(column(contract, 'id').type, 'integer');
		assert.deepEqual(pickFlags(column(contract, 'id')), { pk: true, nn: true, unique: false, fk: false });
		assert.deepEqual(pickFlags(column(contract, 'order_id')), { pk: false, nn: false, unique: false, fk: true });
		assert.deepEqual(pickFlags(column(contract, 'customer_id')), { pk: false, nn: true, unique: false, fk: true });
		assert.deepEqual(pickFlags(column(contract, 'product_id')), { pk: false, nn: true, unique: false, fk: true });
		assert.equal(column(contract, 'notes').type, 'text');

		assertRelation(result.model, 'contract_orders', ['order_id'], 'orders', ['id']);
		assertRelation(result.model, 'contract_orders', ['customer_id'], 'customers', ['id']);
		assertRelation(result.model, 'contract_orders', ['product_id'], 'products', ['id']);
		assert.equal(relationCount(result.model, 'contract_orders', ['order_id'], 'orders', ['id']), 1);
	});

	test('maps SQL ref/source lineage upstream to downstream', async () => {
		const result = await mapDbtProject(ymlDir, { lineage: true });
		assert.equal(result.source, 'yml');
		assert.equal(result.mode, 'lineage');
		assertShape(result.model);
		assertRelation(result.model, 'raw.payments', [], 'orders', []);
		assertRelation(result.model, 'customers', [], 'orders', []);
		assertRelation(result.model, 'orders', [], 'order_items', []);
		assertRelation(result.model, 'products', [], 'order_items', []);
		assertRelation(result.model, 'customers', [], 'customer_segments', []);
		assertRelation(result.model, 'country_codes', [], 'customer_segments', []);
		assertRelation(result.model, 'orders', [], 'order_status_snapshot', []);
		assert.ok(result.model.relations.every((rel) => rel.fromCols.length === 0 && rel.toCols.length === 0));
		assert.equal(result.model.relations.some((rel) => rel.toTable === 'ephemeral_rollup' || rel.toTable === 'disabled_model'), false);
	});
});

function tableNames(model) {
	return model.tables.map((candidate) => candidate.name).sort();
}

function table(model, name) {
	const found = model.tables.find((candidate) => candidate.name === name);
	assert.ok(found, `missing table ${name}`);
	return found;
}

function column(table, name) {
	const found = table.columns.find((candidate) => candidate.name === name);
	assert.ok(found, `missing column ${table.name}.${name}`);
	return found;
}

function assertRelation(model, fromTable, fromCols, toTable, toCols) {
	const found = model.relations.find((rel) => {
		return rel.fromTable === fromTable
			&& rel.toTable === toTable
			&& sameArray(rel.fromCols, fromCols)
			&& sameArray(rel.toCols, toCols);
	});
	assert.ok(found, `missing relation ${fromTable}(${fromCols.join(',')}) -> ${toTable}(${toCols.join(',')})`);
}

function relationCount(model, fromTable, fromCols, toTable, toCols) {
	return model.relations.filter((rel) => {
		return rel.fromTable === fromTable
			&& rel.toTable === toTable
			&& sameArray(rel.fromCols, fromCols)
			&& sameArray(rel.toCols, toCols);
	}).length;
}

function assertShape(model) {
	const tablesByKey = new Map(model.tables.map((candidate) => [candidate.key, candidate]));
	for (const candidate of model.tables) {
		assert.equal(candidate.key, candidate.name.toLowerCase());
		assert.ok(Array.isArray(candidate.columns));
		for (const col of candidate.columns) {
			assert.equal(typeof col.name, 'string');
			assert.equal(typeof col.type, 'string');
			assert.equal(typeof col.typeRaw, 'string');
			assert.equal(typeof col.pk, 'boolean');
			assert.equal(typeof col.nn, 'boolean');
			assert.equal(typeof col.unique, 'boolean');
			assert.equal(typeof col.fk, 'boolean');
		}
	}
	for (const rel of model.relations) {
		assert.ok(tablesByKey.has(rel.fromTable.toLowerCase()), `unresolved fromTable ${rel.fromTable}`);
		const target = tablesByKey.get((rel.toTable || '').toLowerCase());
		assert.ok(target || rel.toMissing === true, `unresolved toTable ${rel.toTable}`);
	}
}

function assertStats(result) {
	assert.deepEqual(result.stats, {
		tables: result.model.tables.length,
		relations: result.model.relations.length,
		columns: result.model.tables.reduce((sum, candidate) => sum + candidate.columns.length, 0),
	});
}

function pickFlags(col) {
	return { pk: col.pk, nn: col.nn, unique: col.unique, fk: col.fk };
}

function sameArray(a, b) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}
