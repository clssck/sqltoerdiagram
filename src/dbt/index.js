import fs from 'node:fs';
import path from 'node:path';
import { findDbtProjects, isDbtProject } from './detect.js';
import { getProjectName, readYamlFile } from './common.js';
import { mapArtifacts } from './manifest.js';
import { mapFallback } from './fallback.js';

export { findDbtProjects, isDbtProject };

export async function mapDbtProject(projectDir, { lineage = false } = {}) {
	if (!isDbtProject(projectDir)) {
		throw new Error(`Not a dbt project: ${projectDir} (missing dbt_project.yml)`);
	}
	const projectConfig = readYamlFile(path.join(projectDir, 'dbt_project.yml'));
	const project = getProjectName(projectConfig, projectDir);
	const manifestPath = path.join(projectDir, 'target', 'manifest.json');
	if (fs.existsSync(manifestPath)) return mapArtifacts(projectDir, project, { lineage });
	return mapFallback(projectDir, projectConfig, project, { lineage });
}
