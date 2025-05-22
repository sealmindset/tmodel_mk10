// Service for components
export async function fetchAllComponents(pool) {
  const query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM vulnerabilities v WHERE v.component_id = c.id) AS vulnerability_count,
      (SELECT COUNT(*) FROM vulnerabilities v WHERE v.component_id = c.id AND v.severity = 'Critical') AS critical_count,
      (SELECT COUNT(*) FROM vulnerabilities v WHERE v.component_id = c.id AND v.severity = 'High') AS high_count,
      (SELECT COUNT(*) FROM project_components pc WHERE pc.component_id = c.id) AS project_count
    FROM components c
    ORDER BY c.name
  `;
  const { rows } = await pool.query(query);
  return rows;
}
