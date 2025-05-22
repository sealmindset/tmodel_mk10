/**
 * Threat Model Assignments Vanilla JS
 * 
 * A non-React implementation of the threat model assignments functionality
 * to ensure it works regardless of React loading issues.
 */

// Add event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing threat model assignments');
  initThreatModelAssignments();
});

/**
 * Get project ID from URL
 */
function getProjectIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  const projectsIndex = pathParts.indexOf('projects');
  if (projectsIndex !== -1 && projectsIndex < pathParts.length - 1) {
    return pathParts[projectsIndex + 1];
  }
  return null;
}

/**
 * Check if a string is a valid UUID v4
 */
function isValidUUID(uuid) {
  // UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Main initialization function
 */
function initThreatModelAssignments() {
  console.log('Initializing vanilla threat model assignments');
  
  // Get project ID from the URL
  const projectId = getProjectIdFromUrl();
  console.log('Extracted project ID:', projectId);

  // On the projects list page, there won't be a project ID in the URL, and that's perfectly fine
  // Just silently return without showing any error messages
  if (!projectId) {
    console.log('No project ID in URL - likely on the projects list page');
    return;
  }

  // Only validate the UUID if we're on a specific project page
  if (!isValidUUID(projectId)) {
    console.log('Invalid project ID format:', projectId);
    // Don't show error messages on the projects list page
    if (window.location.pathname.includes('/project/')) {
      showErrorMessage('Invalid project ID. Please check the URL or contact support.');
    }
    return;
  }

  // Initialize the UI
  const container = document.getElementById('threatModelAssignmentsContainer');
  if (!container) {
    console.error('Threat model assignments container not found');
    return;
  }
  
  console.log('Initialization complete, setting up assign button handlers');
  
  // Set up event delegation for assignThreatModelsBtn clicks
  document.addEventListener('click', function(event) {
    const btn = event.target.closest('.assignThreatModelsBtn');
    if (!btn) return;
    
    event.preventDefault();
    const projectId = btn.getAttribute('data-project-id');
    
    if (!projectId) {
      console.error('No project ID found on button');
      return;
    }
    
    console.log('[ASSIGN] Assign Threat Models button clicked for project:', projectId);
    
    if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      console.error('[ASSIGN] Bootstrap JS is not loaded. Modal cannot be opened.');
      alert('Bootstrap JS is not loaded. Please ensure Bootstrap is included.');
      return;
    }
    
    console.log('[ASSIGN] Opening assignment modal for project:', projectId);
    openAssignModal(projectId);
  });
  
  // Show loading state
  showLoading();
  
  // Fetch threat models assigned to this project
  fetchThreatModels(projectId, container);
}

/**
 * Fetch threat models assigned to this project
 */
function fetchThreatModels(projectId, container) {
  if (!projectId || !container) {
    console.error('Missing projectId or container in fetchThreatModels');
    showErrorMessage('Unable to load threat models. Please refresh the page.', container);
    return;
  }

  console.log(`Fetching threat models for project ${projectId}`);
  showLoading(container);

  // Add a cache-busting parameter to prevent browser caching
  const timestamp = new Date().getTime();
  fetch(`/api/projects/${projectId}/threat-models?_=${timestamp}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || typeof data !== 'object') {
        console.error('Malformed response from backend:', data);
        showErrorMessage('Malformed response from server. Please try again.', container);
        return;
      }
      if (data.success === false) {
        console.error('Backend returned failure:', data.error);
        showErrorMessage(data.error || 'Failed to load threat models. Please try again.', container);
        return;
      }
      if (!Array.isArray(data.data)) {
        console.warn('No threat models array returned. Defaulting to empty.');
        renderThreatModelsList([], projectId, container);
        return;
      }
      console.log(`Fetched ${data.data.length} threat models for project ${projectId}`);
      renderThreatModelsList(data.data, projectId, container);
    })
    .catch(error => {
      console.error(`Error fetching threat models for project ${projectId}:`, error);
      showErrorMessage('Failed to load available threat models. Please try again later.', container);
    });
}

/**
 * Render the list of threat models
 */
function renderThreatModelsList(threatModels, projectId, container) {
  if (!container) {
    console.error('Missing container in renderThreatModelsList');
    return;
  }

  // Defensive: treat null/undefined as empty
  if (!Array.isArray(threatModels) || threatModels.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info" role="alert">
        No threat models are currently assigned to this project.
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
        openAssignModal(projectId);
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
    let modelUrl = '';
    if (source === 'redis') {
      // Redis-based threat models should link to results page with subjectid
      modelUrl = `/results?subjectid=${modelId}`;
    } else {
      // PostgreSQL-based threat models link to the threat-models page
      modelUrl = `/models/${modelId}`;
    }
    
    console.log(`Creating link for model ${modelId}, source: ${source}, URL: ${modelUrl}`);
    
    html += `
      <tr data-id="${modelId}" data-source="${source}">
        <td>
          <a href="${modelUrl}" target="_blank">
            ${model.title || 'Untitled Threat Model'}
          </a>
        </td>
        <td>${createdDate}</td>
        <td>
          <span class="badge bg-${statusClass}">
            ${model.status || 'Draft'}
          </span>
        </td>
        <td>
          <div class="btn-group btn-group-sm">
            <a href="${modelUrl}" class="btn btn-outline-primary" title="View Threat Model" target="_blank">
              <i class="bi bi-eye"></i>
            </a>
            <button
              class="btn btn-outline-danger remove-threat-model-btn"
              data-id="${modelId}"
              title="Remove Assignment"
            >
              <i class="bi bi-trash"></i>
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
  
  // Add event listeners to remove buttons
  const removeButtons = container.querySelectorAll('.remove-threat-model-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const threatModelId = this.getAttribute('data-id');
      if (confirm('Are you sure you want to remove this threat model from the project?')) {
        removeThreatModel(threatModelId, projectId, container);
      }
    });
  });

  // Always re-attach the event listener to the Assign Threat Models button after rendering
  const assignBtn = document.getElementById('assignThreatModelsBtn');
  if (assignBtn) {
    // Remove any existing listeners by cloning and replacing
    const newBtn = assignBtn.cloneNode(true);
    assignBtn.parentNode.replaceChild(newBtn, assignBtn);
    newBtn.addEventListener('click', function() {
      openAssignModal(projectId);
    });
  }
}

/**
 * Remove a threat model from the project
 */
function removeThreatModel(threatModelId, projectId, container) {
  fetch(`/api/projects/${projectId}/threat-models/${threatModelId}`, {
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
    // Clear cache first, then fetch threat models
    fetch(`/api/projects/${projectId}/clear-cache`, { method: 'POST' })
      .then(data => {
        console.log(`Data received for project ${projectId}:`, data);
        fetchThreatModels(projectId, container);
      })
      .catch(() => {
        // If cache clearing fails, still try to refresh
        fetchThreatModels(projectId, container);
      });
  })
  .catch(error => {
    console.error('Error removing threat model:', error);
    alert('Failed to remove threat model: ' + error.message);
  });
}

/**
 * Open the assign modal
 */
function openAssignModal(projectId) {
  console.log('[MODAL] openAssignModal called with projectId:', projectId);
  
  // First create a container for the modal if it doesn't exist
  let modalContainer = document.getElementById('threatModelAssignmentsModal');
  if (!modalContainer) {
    console.warn('[MODAL] Modal container not found in DOM, creating it');
    modalContainer = document.createElement('div');
    modalContainer.id = 'threatModelAssignmentsModal';
    document.body.appendChild(modalContainer);
  }
  
  // Clear any existing modal content
  modalContainer.innerHTML = '';
  
  // Create the modal HTML
  console.log('[MODAL] Creating modal HTML');
  const modalHtml = `
    <div class="modal fade" id="assignThreatModelsModal" tabindex="-1" aria-labelledby="assignThreatModelsModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="assignThreatModelsModalLabel">Assign Threat Models</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="assignModalContent">
            <div class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2">Loading threat models...</p>
            </div>
          </div>
          <div class="modal-footer">
            <div class="me-auto">
              <span class="badge bg-primary" id="selectedCountBadge">0 selected</span>
            </div>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="assignSelectedBtn" disabled>Assign Selected</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add the modal to the container
  modalContainer.innerHTML = modalHtml;
  
  // Get the modal element
  const modal = document.getElementById('assignThreatModelsModal');
  console.log('[MODAL] Modal element created:', modal);
  
  // Add event listener for select all checkbox
  modal.addEventListener('change', function(e) {
    console.log('[MODAL] Change event:', e.target);
    if (e.target.id === 'selectAllThreatModels') {
      const checkboxes = modal.querySelectorAll('.threat-model-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
      updateSelectedCount();
    } else if (e.target.classList.contains('threat-model-checkbox')) {
      updateSelectedCount();
    }
  });
  
  // Add event listener for search input
  modal.addEventListener('input', function(e) {
    if (e.target.id === 'threatModelSearchInput') {
      filterThreatModels(e.target.value);
    }
  });
  
  // Add event listener to assign button
  const assignSelectedBtn = document.getElementById('assignSelectedBtn');
  if (assignSelectedBtn) {
    console.log('[MODAL] Assign Selected button found, adding click listener');
    assignSelectedBtn.addEventListener('click', function() {
      console.log('[MODAL] Assign Selected button clicked');
      assignSelectedThreatModels(projectId);
    });
  } else {
    console.error('[MODAL] Assign Selected button NOT found');
  }
  
  // Show the modal
  try {
    const bsModal = new bootstrap.Modal(modal);
    console.log('[MODAL] Bootstrap modal instance created:', bsModal);
    bsModal.show();
    console.log('[MODAL] Modal should now be visible');
    
    // Load threat models after the modal is shown
    setTimeout(() => {
      loadAvailableThreatModels(projectId);
    }, 100);
  } catch (err) {
    console.error('[MODAL] Error showing modal:', err);
  }
}

/**
 * Load available threat models for assignment
 */
function loadAvailableThreatModels(projectId) {
  console.log('[LOAD] loadAvailableThreatModels called with projectId:', projectId);
  
  // Try to find the content element multiple times if needed
  let attempts = 0;
  const maxAttempts = 5;
  
  function attemptLoad() {
    const modalContent = document.getElementById('assignModalContent');
    if (!modalContent) {
      attempts++;
      if (attempts < maxAttempts) {
        console.warn(`[LOAD] Modal content not found, retrying (${attempts}/${maxAttempts})...`);
        setTimeout(attemptLoad, 100);
        return;
      }
      console.error('[LOAD] Modal content not found after multiple attempts');
      
      // Try to create the element
      const modal = document.querySelector('.modal-content');
      if (modal) {
        const newContent = document.createElement('div');
        newContent.id = 'assignModalContent';
        newContent.className = 'modal-body';
        const header = modal.querySelector('.modal-header');
        if (header && header.nextSibling) {
          modal.insertBefore(newContent, header.nextSibling);
          loadContent(newContent);
          return;
        }
      }
      
      alert('Could not load threat models. Please refresh and try again.');
      return;
    }
    
    // If we get here, we found the element
    loadContent(modalContent);
  }
  
  function loadContent(container) {
    // Show loading indicator
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading threat models...</p>
      </div>
    `;
  
    // Fetch the unassigned threat models
    fetch(`/api/projects/${projectId}/unassigned-threat-models`)
      .then(response => {
        console.log('[LOAD] Fetched unassigned threat models response:', response);
        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[LOAD] Data received from backend:', data);
        renderAvailableThreatModels(data.data || []);
      })
      .catch(error => {
        console.error('[LOAD] Error loading available threat models:', error);
        container.innerHTML = `
          <div class="alert alert-danger" role="alert">
            Failed to load available threat models. Please try again later.
            <button class="btn btn-sm btn-outline-primary ms-2" onclick="loadAvailableThreatModels('${projectId}')">Try Again</button>
          </div>
        `;
      });
  }
  
  // Start the loading process
  attemptLoad();
}

/**
 * Render available threat models in the modal
 */
// --- PAGINATION STATE ---
let paginationState = {
  threatModels: [],
  currentPage: 1,
  pageSize: 10,
  filteredThreatModels: null // for search
};

function renderAvailableThreatModels(threatModels) {
  const modalContent = document.getElementById('assignModalContent');
  if (!modalContent) return;

  // Only update paginationState.threatModels if new data is provided (i.e., from backend load)
  if (Array.isArray(threatModels) && threatModels.length > 0 && threatModels !== paginationState.threatModels) {
    paginationState.threatModels = threatModels;
    paginationState.currentPage = 1;
    paginationState.filteredThreatModels = null;
  }

  // Use filtered list if present (for search)
  const modelsToShow = paginationState.filteredThreatModels || paginationState.threatModels;

  if (!modelsToShow || modelsToShow.length === 0) {
    modalContent.innerHTML = `
      <div class="alert alert-info" role="alert">
        No threat models available for assignment. All threat models are already assigned to this project.
      </div>
    `;
    return;
  }
  
  let html = `
    <div class="mb-3">
      <input type="text" class="form-control" id="threatModelSearchInput" placeholder="Search threat models...">
    </div>
    <div class="mb-3">
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="selectAllThreatModels">
        <label class="form-check-label" for="selectAllThreatModels">
          Select All
        </label>
      </div>
    </div>
    <div class="table-responsive mb-3">
      <table class="table table-striped table-hover align-middle" id="availableThreatModelsTable">
        <thead class="table-light">
          <tr>
            <th style="width:40px" class="text-center">
              <input class="form-check-input" type="checkbox" id="selectAllThreatModels">
            </th>
            <th>Title</th>
            <th>Threats</th>
          </tr>
        </thead>
        <tbody id="availableThreatModelsList">
  `;

  // --- PAGINATION LOGIC ---
  const pageSize = paginationState.pageSize;
  const currentPage = paginationState.currentPage;
  const total = modelsToShow.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageModels = modelsToShow.slice(start, end);

  pageModels.forEach(tm => {
    const id = tm.id || tm._id || '';
    const title = tm.title || tm.name || 'Untitled Threat Model';
    const description = tm.description || '';
    const status = tm.status || '';
    const createdDate = tm.created_at ? new Date(tm.created_at).toLocaleDateString() : 'Unknown';
    html += `
      <tr>
        <td class="text-center">
          <input class="form-check-input threat-model-checkbox" type="checkbox" id="tm-${id}" data-id="${id}">
        </td>
        <td><label class="form-check-label mb-0" for="tm-${id}">${title}</label></td>
        <td><span class="badge bg-primary">${typeof tm.threat_count === 'number' ? tm.threat_count : (tm.threat_count || 0)}</span></td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // --- PAGINATION CONTROLS ---
  if (totalPages > 1) {
    html += `
      <nav class="d-flex justify-content-center">
        <ul class="pagination mb-0">
          <li class="page-item${currentPage === 1 ? ' disabled' : ''}">
            <button class="page-link" id="prevThreatModelPage">Previous</button>
          </li>
          <li class="page-item disabled">
            <span class="page-link">Page ${currentPage} of ${totalPages}</span>
          </li>
          <li class="page-item${currentPage === totalPages ? ' disabled' : ''}">
            <button class="page-link" id="nextThreatModelPage">Next</button>
          </li>
        </ul>
      </nav>
    `;
  }

  modalContent.innerHTML = html;

  // PAGE NAVIGATION EVENTS
  if (totalPages > 1) {
    const prevBtn = document.getElementById('prevThreatModelPage');
    const nextBtn = document.getElementById('nextThreatModelPage');
    if (prevBtn) prevBtn.onclick = function() {
      if (paginationState.currentPage > 1) {
        paginationState.currentPage = 1;
        renderAvailableThreatModels();
      }
    };
    if (nextBtn) nextBtn.onclick = function() {
      if (paginationState.currentPage < totalPages) {
        paginationState.currentPage++;
        renderAvailableThreatModels();
        renderAvailableThreatModels(paginationState.filteredThreatModels || paginationState.threatModels);
      }
    };
  }

  // SEARCH EVENT
  const searchInput = document.getElementById('threatModelSearchInput');
  if (searchInput) {
    // Do not filter or update table on input. Only update on Enter.
    searchInput.oninput = function() {
      // No-op: allow user to type freely, do not filter yet
    };


    // Only jump to and focus the first match on Enter
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) {
          paginationState.filteredThreatModels = null;
        } else {
          paginationState.filteredThreatModels = paginationState.threatModels.filter(tm => {
            const title = (tm.title || tm.name || '').toLowerCase();
            const desc = (tm.description || '').toLowerCase();
            return title.includes(query) || desc.includes(query);
          });
        }
        paginationState.currentPage = 1;
        renderAvailableThreatModels(paginationState.filteredThreatModels || paginationState.threatModels);
        setTimeout(() => {
          const firstCheckbox = document.querySelector('.threat-model-checkbox');
          if (firstCheckbox) {
            firstCheckbox.focus();
          }
        }, 100);
      }
    });
  }

  // RE-INIT CHECKBOX/SELECT EVENTS
  updateSelectedCount();
  // (Re-bind select all)
  const selectAll = document.getElementById('selectAllThreatModels');
  if (selectAll) {
    selectAll.onchange = function() {
      const checkboxes = document.querySelectorAll('.threat-model-checkbox');
      checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
      updateSelectedCount();
    };
  }
  // (Re-bind individual checkboxes)
  const checkboxes = document.querySelectorAll('.threat-model-checkbox');
  checkboxes.forEach(cb => {
    cb.onchange = updateSelectedCount;
  });
}


/**
 * Filter threat models based on search query
 */
function filterThreatModels(query) {
  const list = document.getElementById('availableThreatModelsList');
  if (!list) return;
  
  const items = list.querySelectorAll('.list-group-item');
  const lowerQuery = query.toLowerCase();
  
  items.forEach(item => {
    const title = item.querySelector('label').textContent.trim().toLowerCase();
    const description = item.querySelector('p')?.textContent.trim().toLowerCase() || '';
    
    if (title.includes(lowerQuery) || description.includes(lowerQuery)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Update the selected count badge
 */
function updateSelectedCount() {
  const selectedCheckboxes = document.querySelectorAll('.threat-model-checkbox:checked');
  const countBadge = document.getElementById('selectedCountBadge');
  const assignButton = document.getElementById('assignSelectedBtn');
  
  if (countBadge) {
    countBadge.textContent = `${selectedCheckboxes.length} selected`;
  }
  
  if (assignButton) {
    assignButton.disabled = selectedCheckboxes.length === 0;
  }
}

/**
 * Assign selected threat models to the project
 */
function assignSelectedThreatModels(projectId) {
  const selectedCheckboxes = document.querySelectorAll('.threat-model-checkbox:checked');
  
  // If no checkboxes are selected, do nothing
  if (selectedCheckboxes.length === 0) {
    console.log('No threat models selected');
    alert('Please select at least one threat model to assign.');
    return;
  }
  
  // Debug - check the selected checkboxes
  console.log('[ASSIGN] Selected checkboxes:', selectedCheckboxes);
  selectedCheckboxes.forEach((cb, i) => {
    console.log(`[ASSIGN] Checkbox ${i}:`, cb, 'data-id:', cb.getAttribute('data-id'));
  });
  
  // Update assign button to disabled + loading state
  const assignButton = document.getElementById('assignSelectedBtn');
  
  // Store the original button text
  const originalText = assignButton ? assignButton.innerHTML : 'Assign Selected';
  
  // Update button for loading state
  if (assignButton) {
    assignButton.disabled = true;
    assignButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Assigning...';
  }
  
  // Set a timeout to re-enable the button if the request takes too long or fails silently
  const buttonResetTimeout = setTimeout(() => {
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = originalText;
    }
  }, 10000); // 10 seconds
  
  // Get selected threat model IDs - with less restrictive filtering
  const threatModelIds = Array.from(selectedCheckboxes)
    .map(cb => cb.getAttribute('data-id'))
    .filter(id => id && id.trim() !== ''); // Just filter out empty values
  
  console.log('[ASSIGN] Selected threat model IDs for assignment:', threatModelIds);
  
  // Safety check - if the array is empty, show error and return
  if (threatModelIds.length === 0) {
    clearTimeout(buttonResetTimeout);
    alert('No valid threat model IDs found. Please try again or contact support.');
    
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = originalText;
    }
    return;
  }
  
  // Get the modal instance
  const modalElement = document.getElementById('assignThreatModelsModal');
  const modal = modalElement ? bootstrap.Modal.getInstance(modalElement) : null;
  
  // Call API to assign threat models
  fetch(`/api/projects/${projectId}/threat-models`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      threatModelIds: threatModelIds // Server expects 'threatModelIds', not 'threat_model_ids'
    })
  })
  .then(response => {
    // Clear the timeout since we got a response
    clearTimeout(buttonResetTimeout);
    
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Assignment API response:', data);
    
    // Immediately reset button state
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = 'Assign Selected';
    }
    
    // Show success message
    alert('Threat models assigned successfully');
    
    // Close the modal if it exists
    if (modal) {
      modal.hide();
    }
    
    // Reload the page to show the updated assignments
    setTimeout(() => {
      window.location.reload();
    }, 500);
  })
  .catch(error => {
    // Clear the timeout since we got a response
    clearTimeout(buttonResetTimeout);
    
    console.error('Error assigning threat models:', error);
    
    // Reset button state
    if (assignButton) {
      assignButton.disabled = false;
      assignButton.innerHTML = 'Assign Selected';
    }
    
    // Show error message
    alert('Failed to assign threat models: ' + error.message);
  });
}

/**
 * Show loading state
 */
function showLoading(container) {
  if (!container) {
    container = document.getElementById('threatModelAssignmentsContainer');
  }
  if (!container) return;
  
  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading threat models...</p>
    </div>
  `;
}

/**
 * Show error message
 */
function showErrorMessage(message, container) {
  if (!container) {
    container = document.getElementById('threatModelAssignmentsContainer');
  }
  if (!container) return;
  
  container.innerHTML = `
    <div class="alert alert-warning">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      ${message || 'Unable to load threat models. Please try again later.'}
      <button class="btn btn-sm btn-outline-primary ms-3" onclick="window.location.reload()">
        Refresh Page
      </button>
    </div>
  `;
}

/**
 * Get the status class for a threat model status
 */
function getStatusClass(status) {
  switch(status) {
    case 'Active': return 'success';
    case 'Draft': return 'secondary';
    case 'In Review': return 'info';
    case 'Approved': return 'primary';
    case 'Deprecated': return 'warning';
    default: return 'secondary';
  }
}
