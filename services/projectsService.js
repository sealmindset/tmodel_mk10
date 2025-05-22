// services/projectsService.js
// Real PostgreSQL CRUD service for projects
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const TABLE = 'threat_model.projects';

async function getAll() {
  const { rows } = await db.query(`SELECT * FROM ${TABLE} ORDER BY created_at DESC`);
  return rows;
}

async function getById(id) {
  const { rows } = await db.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ name, description, business_unit, criticality, data_classification, status, created_by }) {
  const id = uuidv4();
  const { rows } = await db.query(
    `INSERT INTO ${TABLE} (id, name, description, business_unit, criticality, data_classification, status, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
    [id, name, description, business_unit, criticality, data_classification, status, created_by]
  );
  return rows[0];
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return null;
  const set = keys.map((k,i) => `${k} = $${i+2}`).join(', ');
  const values = [id, ...keys.map(k => fields[k])];
  const { rows } = await db.query(
    `UPDATE ${TABLE} SET ${set}, updated_at=NOW() WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0];
}

async function remove(id) {
  const { rowCount } = await db.query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  return rowCount > 0;
}

module.exports = { getAll, getById, create, update, remove };
