// DEPRECATED: Logic for Assign Components modal is now handled in reusable-assign-components-modal.js
// This file is no longer used. Please update all references.
document.addEventListener('DOMContentLoaded', function () {
  const assignComponentsModal = document.getElementById('assignComponentsModal');
  if (!assignComponentsModal) return;

  let components = [];
  let projectId = null;

  assignComponentsModal.addEventListener('show.bs.modal', function (event) {
    // Get projectId from the button or context
    const trigger = event.relatedTarget;
    projectId = trigger?.getAttribute('data-project-id') || document.querySelector('input[name="projectId"]').value;
    fetchComponents();
  });

  function fetchComponents() {
    fetch('/api/components')
      .then(res => res.json())
      .then(data => {
        // Defensive: handle array or wrapped response
        if (Array.isArray(data)) {
          components = data;
        } else if (data && Array.isArray(data.data)) {
          components = data.data;
        } else {
          components = [];
          showComponentsError('Failed to load components.');
        }
        renderComponentsList();
      });
  }

  function renderComponentsList() {
    const listDiv = document.getElementById('components-list');
    if (!listDiv) return;
    if (!Array.isArray(components) || components.length === 0) {
      listDiv.innerHTML = '<div class="alert alert-warning">No components available.</div>';
      return;
    }
    // Render as table (like Assign Threat Models)
    let html = '<table class="table table-bordered table-hover table-sm"><thead><tr><th></th><th>Name</th><th>Description</th></tr></thead><tbody>';
    for (const c of components) {
      html += `<tr>
        <td><input class="form-check-input" type="checkbox" value="${c.id}" id="component-${c.id}" name="componentIds"></td>
        <td><label class="form-check-label" for="component-${c.id}"><strong>${c.name}</strong></label></td>
        <td><span class="text-muted small">${c.description || ''}</span></td>
      </tr>`;
    }
    html += '</tbody></table>';
    listDiv.innerHTML = html;
  }

  function showComponentsError(msg) {
    const listDiv = document.getElementById('components-list');
    if (listDiv) listDiv.innerHTML = `<div class='alert alert-danger'>${msg}</div>`;
  }

  document.getElementById('assign-components-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const checked = Array.from(document.querySelectorAll('#components-list input[name="componentIds"]:checked')).map(cb => cb.value);
    if (!checked.length) {
      setFeedback('Please select at least one component.', 'danger');
      return;
    }
    fetch(`/api/projects/${projectId}/components/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentIds: checked })
    })
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(() => {
        setFeedback('Components assigned successfully.', 'success');
        setTimeout(() => {
          bootstrap.Modal.getInstance(assignComponentsModal).hide();
          window.location.reload();
        }, 800);
      })
      .catch(() => setFeedback('Failed to assign components.', 'danger'));
  });

  function setFeedback(msg, type) {
    const el = document.getElementById('assign-components-feedback');
    el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  }
});
