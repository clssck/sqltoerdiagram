import fs from 'node:fs';
import path from 'node:path';
import { SKIP_DIRS } from './common.js';

export function isDbtProject(dir) {
	return fs.existsSync(path.join(dir, 'dbt_project.yml'));
}

export function findDbtProjects(rootDir) {
	const projects = [];
	function walk(dir) {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		if (isDbtProject(dir)) projects.push(dir);
		for (const entry of entries) {
			if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
		}
	}
	walk(rootDir);
	return projects;
}
