// public/js/results-crud.js
// Frontend CRUD logic for /api/results

async function fetchResults() {
  const response = await fetch('/api/results', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch results');
  const json = await response.json();
  return json.data;
}

async function fetchResultById(id) {
  const response = await fetch(`/api/results/${id}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Result not found');
  const json = await response.json();
  return json.data;
}

async function createResult({ title, description, response_text, project_id }) {
  const response = await fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, description, response_text, project_id })
  });
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Server returned an invalid response.');
  }
  if (!response.ok || !data.success) {
    let msg = data && data.error ? data.error : `Failed to create result (HTTP ${response.status})`;
    throw new Error(msg);
  }
  return data.data;
}

async function updateResult(id, { title, description, response_text, project_id }) {
  const response = await fetch(`/api/results/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title, description, response_text, project_id })
  });
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Server returned an invalid response.');
  }
  if (!response.ok || !data.success) {
    // Prefer backend error, then fallback to HTTP status, then generic
    let msg = data && data.error ? data.error : `Failed to update result (HTTP ${response.status})`;
    throw new Error(msg);
  }
  return data.data;
}

async function deleteResult(id) {
  const response = await fetch(`/api/results/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Server returned an invalid response.');
  }
  if (!response.ok || !data.success) {
    let msg = data && data.error ? data.error : `Failed to delete result (HTTP ${response.status})`;
    throw new Error(msg);
  }
  return data.data;
}

// Export functions for use in other scripts
window.resultsCrud = {
  fetchResults,
  fetchResultById,
  createResult,
  updateResult,
  deleteResult
};
