// public/js/models-crud.js
// Frontend CRUD logic for /api/models

async function fetchModels() {
  const response = await fetch('/api/models', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch models');
  const json = await response.json();
  return json.data;
}

async function fetchModelById(id) {
  const response = await fetch(`/api/models/${id}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Model not found');
  const json = await response.json();
  return json.data;
}

async function createModel({ title, description, response_text, model, model_version, status, project_id, source }) {
  const response = await fetch('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, description, response_text, model, model_version, status, project_id, source })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create model');
  }
  return (await response.json()).data;
}

async function updateModel(id, { title, description, response_text, model, model_version, status, project_id, source }) {
  const response = await fetch(`/api/models/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, description, response_text, model, model_version, status, project_id, source })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update model');
  }
  return (await response.json()).data;
}

async function deleteModel(id) {
  const response = await fetch(`/api/models/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to delete model');
  }
  return (await response.json()).data;
}

// Export functions for use in other scripts
window.modelsCrud = {
  fetchModels,
  fetchModelById,
  createModel,
  updateModel,
  deleteModel
};
