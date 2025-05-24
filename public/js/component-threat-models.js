/**
 * Component Threat Models Client-Side JavaScript
 * Handles the display, assignment, and removal of threat models for components
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize the component threat models functionality
  initComponentThreatModels();
});

/**
 * Initialize the component threat models functionality
 */
function initComponentThreatModels() {
  // Get component ID from URL or data attribute
  const pathParts = window.location.pathname.split('/');
  const componentId = pathParts[pathParts.length - 1];
  
  if (!componentId) return;
  
  // Get container element
  const container = document.getElementById('threatModelAssignmentsContainer');
  if (!container) return;
  
  // Initialize assign button
  const assignBtn = document.getElementById('assignThreatModelsBtn');
  if (assignBtn) {
    assignBtn.addEventListener('click', function() {
      openAssignModal(componentId);
    });
  }
  
  // Fetch threat models
  fetchThreatModels(componentId, container);
}

/**
 * Fetch threat models for a component
 */
function fetchThreatModels(componentId, container) {
  if (!componentId || !container) return;
  
  console.log(`Fetching threat models for component ${componentId}`);
  container.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
  
  // Add a cache-busting parameter to prevent browser caching
  const timestamp = new Date().getTime();
  fetch(`/api/components/${componentId}/threat-models?_=${timestamp}`)
    .then(response => {
      console.log(`Response status for component ${componentId}:`, response.status);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(`Fetched ${data.data ? data.data.length : 0} threat models for component ${componentId}`);
      renderThreatModelsList(data.data || [], componentId, container);
    })
    .catch(error => {
      console.error(`Error fetching threat models for component ${componentId}:`, error);
      container.innerHTML = `
        <div class="alert alert-danger" role="alert">
          Failed to load threat models. Please try again later
          <button class="btn btn-sm btn-outline-primary ms-2" onclick="fetchThreatModels('${componentId}', this.parentNode.parentNode)">Try Again</button>
        </div>
      `;
    });
}

/**
 * Render the list of threat models
 */
function renderThreatModelsList(threatModels, componentId, container) {
  if (!container) return;
  
  if (threatModels.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info" role="alert">
        No threat models are currently assigned to this component.
        <button 
          class="btn btn-sm btn-primary ms-3"
          id="emptyStateAssignBtn"
        >
          Assign Threat Models
        </button>
      </div>
    `;
    
    // Add event listener to the button
    const emptyStateAssignBtn = document.getElementById('emptyStateAssignBtn');
    if (emptyStateAssignBtn) {
      emptyStateAssignBtn.addEventListener('click', function() {
        openAssignModal(componentId);
      });
    }
    
    return;
  }
  
  // Render the table with threat models
  let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">Assigned Threat Models</h3>
    </div>
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Title</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  // Add each threat model to the table
  threatModels.forEach(model => {
    const statusClass = getStatusClass(model.status || 'Draft');
    const createdDate = model.created_at ? new Date(model.created_at).toLocaleDateString() : 'Unknown';
    const modelId = model.id || model.subjectid || '';
    const source = model.source || '';
    
    // Determine the correct URL based on the source
    let modelUrl = source === 'redis'
      ? `/results?subjectid=${model.subjectid || model.id}`
      : `/models/${modelId}`;
    
    html += `
      <tr>
        <td>
          <a href="${modelUrl}" class="fw-bold text-decoration-none">
            ${model.name || model.title || 'Unnamed Model'}
          </a>
          ${model.description ? `<small class="d-block text-muted">${truncateText(model.description, 100)}</small>` : ''}
        </td>
        <td>${createdDate}</td>
        <td>
          <span class="badge bg-${statusClass}">${model.status || 'Draft'}</span>
          ${model.threat_count ? `<span class="badge bg-info ms-1">Threats: ${model.threat_count}</span>` : ''}
        </td>
        <td>
          <div class="btn-group">
            <a href="${modelUrl}" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-eye"></i> View
            </a>
            <button class="btn btn-sm btn-outline-danger remove-model-btn" 
                    data-model-id="${modelId}" 
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
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Initialize tooltips
  const tooltips = container.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltips.forEach(tooltip => {
    new bootstrap.Tooltip(tooltip);
  });
  
  // Add event listeners to remove buttons
  const removeButtons = container.querySelectorAll('.remove-model-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const modelId = this.getAttribute('data-model-id');
      const componentId = this.getAttribute('data-component-id');
      
      if (confirm('Are you sure you want to remove this threat model from the component?')) {
        removeThreatModel(modelId, componentId, container);
      }
    });
  });
}

/**
 * Remove a threat model from the component
 */
function removeThreatModel(threatModelId, componentId, container) {
  fetch(`/api/components/${componentId}/threat-models/${threatModelId}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    alert('Threat model removed successfully');
    // Fetch updated threat models
    fetchThreatModels(componentId, container);
  })
  .catch(error => {
    console.error('Error removing threat model:', error);
    alert('Failed to remove threat model: ' + error.message);
  });
}

/**
 * Open the assign modal
 * (Now uses the reusable modal, old implementation removed)
 */
function openAssignModal(componentId) {
  window.openAssignThreatModelsModal({
    contextType: 'component',
    contextId: componentId,
    onAssigned: function() {
      // Refresh the list after assignment
      const container = document.getElementById('threatModelAssignmentsContainer');
      if (container) {
        fetchThreatModels(componentId, container);
      }
    }
  });
}

/**
 * Load available threat models for assignment
 */
function loadAvailableThreatModels(componentId) {
  const modalContent = document.getElementById('assignModalContent');
  if (!modalContent) return;
  
  // Fetch all unassigned threat models for this component
  fetch(`/api/components/${componentId}/unassigned-threat-models`)
    .then(response => {
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      return response.json();
    })
    .then(data => {
      console.log('Unassigned threat models for assignment:', data);
      const available = (data.data || []);
      renderAvailableThreatModels(available);
    })
    .catch(error => {
      console.error('Error loading available threat models:', error);
      modalContent.innerHTML = `
        <div class="alert alert-danger" role="alert">
          Failed to load available threat models. Please try again later
          <button class="btn btn-sm btn-outline-primary ms-2" onclick="loadAvailableThreatModels('${componentId}')">Try Again</button>
        </div>
      `;
    });
}

/**
 * Render available threat models in the modal
 */
function renderAvailableThreatModels(threatModels) {
  const modalContent = document.getElementById('assignModalContent');
  if (!modalContent) return;
  
  if (!threatModels || threatModels.length === 0) {
    modalContent.innerHTML = `
      <div class="alert alert-info" role="alert">
        No threat models available for assignment. All threat models are already assigned to this component.
      </div>
    `;
    return;
  }
  
  console.log('Rendering threat models:', threatModels);
  
  let html = `
    <div class="mb-3">
      <input type="text" class="form-control" id="threatModelSearchInput" placeholder="Search threat models...">
    </div>
    <div class="list-group threat-model-list">
  `;
  
  // Sort by name
  threatModels.sort((a, b) => {
    const aName = a.name || a.title || '';
    const bName = b.name || b.title || '';
    return aName.localeCompare(bName);
  });
  
  // Add each threat model to the list
  threatModels.forEach(tm => {
    const id = tm.id || tm.subjectid || '';
    const title = tm.name || tm.title || 'Unnamed Model';
    const description = tm.description || '';
    const source = tm.source || '';
    
    // Get status
    let status = '';
    if (tm.status) {
      status = tm.status;
    } else if (tm.threatCount !== undefined) {
      // For Redis subjects, use threat count as a status indicator
      status = `${tm.threatCount} threats`;
    }
    
    // Format date
    const createdDate = tm.created_at || tm.createdAt ? new Date(tm.created_at || tm.createdAt).toLocaleDateString() : 'Unknown';
    
    html += `
      <div class="list-group-item list-group-item-action">
        <div class="d-flex w-100 justify-content-between align-items-center">
          <div class="form-check">
            <input class="form-check-input threat-model-checkbox" type="checkbox" id="tm-${id}" data-id="${id}" data-source="${source}">
            <label class="form-check-label" for="tm-${id}">
              ${title}
            </label>
          </div>
          <small class="text-muted">
            ${status ? `Status: ${status} | ` : ''}
            Created: ${createdDate}
            ${source === 'redis' ? '<span class="badge bg-info ms-2">Redis</span>' : ''}
          </small>
        </div>
        ${description ? `<p class="mb-1 small text-muted">${description}</p>` : ''}
      </div>
    `;
  });
  
  html += `
    </div>
  `;
  
  modalContent.innerHTML = html;
  
  // Initialize the selected count
  updateSelectedCount();
  
  // Add event listeners
  const checkboxes = document.querySelectorAll('.threat-model-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      updateSelectedCount();
    });
  });
  
  // Add search functionality
  const searchInput = document.getElementById('threatModelSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterThreatModels(this.value);
    });
  }
}

/**
 * Filter threat models based on search query
 */
function filterThreatModels(query) {
  const items = document.querySelectorAll('.threat-model-list .list-group-item');
  const lowercaseQuery = query.toLowerCase();
  
  items.forEach(item => {
    const title = item.querySelector('.form-check-label').textContent.trim().toLowerCase();
    const description = item.querySelector('p') ? item.querySelector('p').textContent.trim().toLowerCase() : '';
    
    if (title.includes(lowercaseQuery) || description.includes(lowercaseQuery)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Update the selected count in the modal
 */
function updateSelectedCount() {
  const selectedCount = document.getElementById('selectedCount');
  const assignButton = document.getElementById('assignSelectedBtn');
  
  if (!selectedCount || !assignButton) return;
  
  const checkboxes = document.querySelectorAll('.threat-model-checkbox:checked');
  selectedCount.textContent = `${checkboxes.length} selected`;
  
  assignButton.disabled = checkboxes.length === 0;
}

/**
 * Assign selected threat models to the component
 */
function assignSelectedThreatModels(componentId) {
  // Get selected threat model IDs
  const checkboxes = document.querySelectorAll('.threat-model-checkbox:checked');
  const threatModelIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
  
  if (threatModelIds.length === 0) {
    alert('Please select at least one threat model to assign.');
    return;
  }
  
  console.log(`Assigning ${threatModelIds.length} threat models to component ${componentId}`);
  
  // Disable the assign button
  const assignButton = document.getElementById('assignSelectedBtn');
  if (assignButton) {
    assignButton.disabled = true;
    assignButton.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Assigning...
    `;
  }
  
  // Store modal reference for later use
  const modal = bootstrap.Modal.getInstance(document.getElementById('assignThreatModelsModal'));
  
  // Add a timeout to reset the button if the request takes too long
  const buttonResetTimeout = setTimeout(() => {
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = 'Assign Selected';
      console.warn('The operation is taking longer than expected. It may still complete in the background.');
    }
  }, 5000); // 5 seconds timeout
  
  // Send the request
  fetch(`/api/components/${componentId}/threat-models`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ threatModelIds })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    return response.json();
  })
  .then(result => {
    // Clear the timeout since we got a response
    clearTimeout(buttonResetTimeout);
    
    // Reset button state
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = 'Assign Selected';
    }
    
    // Show success message
    alert('Threat models assigned successfully');
    
    // Debug info about the assigned models
    console.log('Assigned threat models:', threatModelIds);

    // Close the modal
    if (modal) {
      alert('Threat models assigned successfully!');
      modal.hide();
    }
    
    // Refresh threat models
    const container = document.getElementById('threatModelAssignmentsContainer');
    if (container) {
      fetchThreatModels(componentId, container);
    }
  })
  .catch(error => {
    // Clear the timeout
    clearTimeout(buttonResetTimeout);
    
    // Reset button state
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = 'Assign Selected';
    }
    
    console.error('Error assigning threat models:', error);
    alert('Failed to assign threat models: ' + error.message);
  });
}

/**
 * Helper function to get status class
 */
function getStatusClass(status) {
  switch(status) {
    case 'Completed':
    case 'Published':
      return 'success';
    case 'Draft':
      return 'warning';
    case 'In Progress':
      return 'info';
    case 'Archived':
      return 'secondary';
    default:
      return 'light';
  }
}

/**
 * Helper function to truncate text
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
