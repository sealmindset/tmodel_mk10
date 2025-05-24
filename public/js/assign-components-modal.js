// DEPRECATED: DO NOT USE THIS FILE. All logic is now in reusable-assign-components-modal.js
console.warn('[DEPRECATED] assign-components-modal.js is obsolete. Use reusable-assign-components-modal.js instead.');
console.warn('[AssignComponentsModal] This file is deprecated. Please update all references to use reusable-assign-components-modal.js');
document.addEventListener('DOMContentLoaded', function () {
  console.log('[AssignComponentsModal] DOMContentLoaded');
  const assignComponentsModal = document.getElementById('assignComponentsModal');
  if (!assignComponentsModal) {
    console.error('[AssignComponentsModal] assignComponentsModal not found. Aborting.');
    return;
  }

  let components = [];
  let projectId = null;

  assignComponentsModal.addEventListener('show.bs.modal', function (event) {
    console.log('[AssignComponentsModal] Modal shown');
    // Get projectId from the button or context
    const trigger = event.relatedTarget;
    projectId = trigger?.getAttribute('data-project-id') || document.querySelector('input[name="projectId"]').value;
    if (!projectId) {
      console.error('[AssignComponentsModal] projectId not found. Aborting fetch.');
      showComponentsError('Project ID not found.');
      return;
    }
    console.log('[AssignComponentsModal] Using projectId:', projectId);
    fetchComponents();
  });

  function fetchComponents() {
    console.log('[AssignComponentsModal] Fetching components from /api/components');
    fetch('/api/components')
      .then(res => {
        console.log('[AssignComponentsModal] Fetch response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[AssignComponentsModal] Fetched data:', data);
        // Defensive: handle array or wrapped response
        if (Array.isArray(data)) {
          components = data;
          console.log('[AssignComponentsModal] Parsed components as array:', components);
        } else if (data && Array.isArray(data.data)) {
          components = data.data;
          console.log('[AssignComponentsModal] Parsed components as data.data:', components);
        } else {
          components = [];
          console.error('[AssignComponentsModal] Failed to parse components. Data:', data);
          showComponentsError('Failed to load components.');
        }
        renderComponentsList();
      })
      .catch(err => {
        components = [];
        console.error('[AssignComponentsModal] Fetch error:', err);
        showComponentsError('Failed to load components (network error).');
        renderComponentsList();
      });
  }

  function renderComponentsList() {
    console.log('[AssignComponentsModal] Rendering components list. Count:', components.length);
    const listDiv = document.getElementById('components-list');
    if (!listDiv) {
      console.error('[AssignComponentsModal] components-list div not found.');
      return;
    }
    if (!Array.isArray(components) || components.length === 0) {
      listDiv.innerHTML = '<div class="alert alert-warning">No components available.</div>';
      console.warn('[AssignComponentsModal] No components available to render.');
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
    console.log('[AssignComponentsModal] Components table rendered.');
  }

  function showComponentsError(msg) {
    const listDiv = document.getElementById('components-list');
    if (listDiv) listDiv.innerHTML = `<div class='alert alert-danger'>${msg}</div>`;
    console.error('[AssignComponentsModal] Show error:', msg);
  }

  const assignForm = document.getElementById('assign-components-form');
  if (!assignForm) {
    console.error('[AssignComponentsModal] assign-components-form not found. Form submission will not work.');
    return;
  }
  assignForm.addEventListener('submit', function (e) {
    e.preventDefault();
    console.log('[AssignComponentsModal] Form submit triggered');
    const checked = Array.from(document.querySelectorAll('#components-list input[name="componentIds"]:checked')).map(cb => cb.value);
    console.log('[AssignComponentsModal] Checked component IDs:', checked);
    if (!checked.length) {
      setFeedback('Please select at least one component.', 'danger');
      console.warn('[AssignComponentsModal] No components selected.');
      return;
    }
    if (!projectId) {
      setFeedback('Project ID missing. Cannot assign components.', 'danger');
      console.error('[AssignComponentsModal] Project ID missing on submit.');
      return;
    }
    const postUrl = `/api/projects/${projectId}/components/assign`;
    console.log('[AssignComponentsModal] Posting to:', postUrl, 'with:', checked);
    fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentIds: checked })
    })
      .then(res => {
        console.log('[AssignComponentsModal] Assign POST response status:', res.status);
        return res.ok ? res.json() : Promise.reject(res);
      })
      .then(() => {
        setFeedback('Components assigned successfully.', 'success');
        console.log('[AssignComponentsModal] Components assigned successfully.');
        setTimeout(() => {
          bootstrap.Modal.getInstance(assignComponentsModal).hide();
          window.location.reload();
        }, 800);
      })
      .catch(err => {
        setFeedback('Failed to assign components.', 'danger');
        console.error('[AssignComponentsModal] Failed to assign components:', err);
      });
  });

  function setFeedback(msg, type) {
    const el = document.getElementById('assign-components-feedback');
    el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  }
});
