/**
 * Component Safeguards Client-Side JavaScript
 * Handles the display, assignment, and removal of safeguards for components
 */

document.addEventListener('DOMContentLoaded', function() {
  initComponentSafeguards();
});

function initComponentSafeguards() {
  const pathParts = window.location.pathname.split('/');
  const componentId = pathParts[pathParts.length - 1];
  if (!componentId) return;
  const container = document.getElementById('safeguardAssignmentsContainer');
  if (!container) return;
  const assignBtn = document.getElementById('assignSafeguardsBtn');
  if (assignBtn) {
    assignBtn.addEventListener('click', function() {
      openAssignSafeguardsModal({ componentId, onAssigned: function() { fetchSafeguards(componentId, container); } });
    });
  }
  fetchSafeguards(componentId, container);
}

function fetchSafeguards(componentId, container) {
  if (!componentId || !container) return;
  container.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
  const timestamp = new Date().getTime();
  fetch(`/api/components/${componentId}/safeguards?_=${timestamp}`)
    .then(response => {
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      renderSafeguardsList(data.data || [], componentId, container);
    })
    .catch(error => {
      container.innerHTML = `<div class="alert alert-danger" role="alert">Failed to load safeguards. Please try again later
        <button class="btn btn-sm btn-outline-primary ms-2" onclick="fetchSafeguards('${componentId}', this.parentNode.parentNode)">Try Again</button>
      </div>`;
    });
}

function renderSafeguardsList(safeguards, componentId, container) {
  if (!container) return;
  if (safeguards.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info" role="alert">
        No safeguards are currently assigned to this component.
        <button class="btn btn-sm btn-primary ms-3" id="emptyStateAssignSafeguardsBtn">Assign Safeguards</button>
      </div>
    `;
    const emptyStateAssignBtn = document.getElementById('emptyStateAssignSafeguardsBtn');
    if (emptyStateAssignBtn) {
      emptyStateAssignBtn.addEventListener('click', function() {
        openAssignSafeguardsModal({ componentId, onAssigned: function() { fetchSafeguards(componentId, container); } });
      });
    }
    return;
  }
  let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">Assigned Safeguards</h3>
    </div>
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;
  safeguards.forEach(sg => {
    html += `
      <tr>
        <td>${sg.name}</td>
        <td>${sg.description || ''}</td>
        <td>${sg.type || ''}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary view-safeguard-btn" 
                    data-safeguard-id="${sg.id}"
                    data-bs-toggle="tooltip"
                    title="View Safeguard">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary edit-safeguard-btn" 
                    data-safeguard-id="${sg.id}"
                    data-bs-toggle="tooltip"
                    title="Edit Safeguard">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger remove-safeguard-btn" 
                    data-safeguard-id="${sg.id}" 
                    data-component-id="${componentId}" 
                    data-bs-toggle="tooltip"
                    title="Remove from component">
              <i class="bi bi-x"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
  const tooltips = container.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltips.forEach(tooltip => { new bootstrap.Tooltip(tooltip); });
  // Add event listeners for View buttons
  const viewButtons = container.querySelectorAll('.view-safeguard-btn');
  viewButtons.forEach(button => {
    button.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      // Redirect to safeguard view page (read-only)
      window.open(`/safeguards/${safeguardId}?mode=view`, '_blank');
    });
  });

  // Add event listeners for Edit buttons
  const editButtons = container.querySelectorAll('.edit-safeguard-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      // Redirect to safeguard edit page
      window.open(`/safeguards/${safeguardId}/edit`, '_blank');
    });
  });

  // Remove safeguard logic
  const removeButtons = container.querySelectorAll('.remove-safeguard-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      const componentId = this.getAttribute('data-component-id');
      if (confirm('Are you sure you want to remove this safeguard from the component?')) {
        removeSafeguard(safeguardId, componentId, container);
      }
    });
  });
}

function removeSafeguard(safeguardId, componentId, container) {
  fetch(`/api/components/${componentId}/safeguards/${safeguardId}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    return response.json();
  })
  .then(() => {
    fetchSafeguards(componentId, container);
  })
  .catch(error => {
    alert('Failed to remove safeguard. Please try again.');
  });
}
