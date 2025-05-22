// Service for handling components and assignments
const db = require('../db');

async function getAllComponents() {
  const result = await db.query('SELECT id, name, description FROM components ORDER BY name');
  return result.rows;
}

async function assignComponentsToProject(projectId, componentIds) {
  if (!Array.isArray(componentIds) || componentIds.length === 0) return;
  const values = componentIds.map(cid => `(${projectId}, ${cid})`).join(',');
  await db.query(`INSERT INTO project_components (project_id, component_id) VALUES ${values} ON CONFLICT DO NOTHING`);
}

async function getProjectComponents(projectId) {
  const result = await db.query(
    'SELECT c.id, c.name, c.description FROM components c INNER JOIN project_components pc ON c.id = pc.component_id WHERE pc.project_id = $1',
    [projectId]
  );
  return result.rows;
}

module.exports = {
  getAllComponents,
  assignComponentsToProject,
  getProjectComponents,
};
