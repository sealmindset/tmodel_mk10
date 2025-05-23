// public/js/components-crud.js
// Frontend CRUD logic for /api/components

async function fetchComponents() {
  const response = await fetch('/api/components', { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to fetch components');
  const json = await response.json();
  return json.data;
}

async function fetchComponentById(id) {
  const response = await fetch(`/api/components/${id}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Component not found');
  const json = await response.json();
  return json.data;
}

async function createComponent({ name, description, type, is_reusable }) {
  const response = await fetch('/api/components', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, description, type, is_reusable })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create component');
  }
  return (await response.json()).data;
}

async function updateComponent(id, { name, description, type, is_reusable }) {
  const response = await fetch(`/api/components/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, description, type, is_reusable })
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update component');
  }
  return (await response.json()).data;
}

async function deleteComponent(id) {
  const response = await fetch(`/api/components/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to delete component');
  }
  return (await response.json()).data;
}

// Bulk actions, export, and selection logic

document.addEventListener('DOMContentLoaded', function() {
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const checkboxes = document.querySelectorAll('.subject-checkbox');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const exportSelectedBtn = document.getElementById('exportSelectedBtn');

  // Select all
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
      checkboxes.forEach(cb => { cb.checked = selectAllCheckbox.checked; });
      updateBulkButtons();
    });
  }
  // Individual selection
  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateBulkButtons);
  });

  function updateBulkButtons() {
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    deleteSelectedBtn.disabled = !anyChecked;
    exportSelectedBtn.disabled = !anyChecked;
  }

  // Delete selected
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', async function() {
      const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
      if (selectedIds.length === 0) return;
      if (!confirm(`Delete ${selectedIds.length} selected components? This cannot be undone.`)) return;
      for (const id of selectedIds) {
        try {
          await deleteComponent(id);
          document.querySelector(`tr[data-id='${id}']`).remove();
        } catch (err) {
          alert(`Failed to delete component: ${err.message}`);
        }
      }
      updateBulkButtons();
    });
  }

  // Export selected
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener('click', async function() {
      const selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
      if (selectedIds.length === 0) return;
      try {
        const resp = await fetch('/api/components/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ids: selectedIds })
        });
        if (!resp.ok) throw new Error('Export failed');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'components_export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    });
  }
});

// Export functions for use in other scripts
window.componentsCrud = {
  fetchComponents,
  fetchComponentById,
  createComponent,
  updateComponent,
  deleteComponent
};
