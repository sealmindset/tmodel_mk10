/**
 * Component Detail Page JavaScript
 * Handles dynamic functionality for the component detail view
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize edit component button
  const editComponentBtn = document.getElementById('editComponentBtn');
  if (editComponentBtn) {
    editComponentBtn.addEventListener('click', function() {
      const modal = new bootstrap.Modal(document.getElementById('editComponentModal'));
      modal.show();
    });
  }
  
  // Initialize edit component details button
  const editComponentDetailsBtn = document.getElementById('editComponentDetailsBtn');
  if (editComponentDetailsBtn) {
    editComponentDetailsBtn.addEventListener('click', function() {
      toggleComponentEdit();
    });
  }
  
  // Initialize add safeguard buttons
  const addSafeguardBtns = document.querySelectorAll('#addSafeguardBtn, #addSafeguardBtn2, #addFirstSafeguardBtn');
  addSafeguardBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = new bootstrap.Modal(document.getElementById('addSafeguardModal'));
      modal.show();
    });
  });
  
  // Save component button
  const saveComponentBtn = document.getElementById('saveComponentBtn');
  if (saveComponentBtn) {
    saveComponentBtn.addEventListener('click', function() {
      saveComponent();
    });
  }
  
  // Save safeguard button
  const saveSafeguardBtn = document.getElementById('saveSafeguardBtn');
  if (saveSafeguardBtn) {
    saveSafeguardBtn.addEventListener('click', function() {
      saveSafeguard();
    });
  }
  
  // Edit safeguard buttons
  const editSafeguardBtns = document.querySelectorAll('.edit-safeguard-btn');
  editSafeguardBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      const safeguardName = this.getAttribute('data-safeguard-name');
      const safeguardStatus = this.getAttribute('data-safeguard-status');
      const safeguardNotes = this.getAttribute('data-safeguard-notes');
      
      // Populate modal with safeguard data
      document.getElementById('safeguardName').value = safeguardName;
      document.getElementById('implementationStatus').value = safeguardStatus;
      document.getElementById('implementationNotes').value = safeguardNotes;
      
      // Update modal title and button text
      document.getElementById('addSafeguardModalLabel').textContent = 'Edit Safeguard';
      document.getElementById('saveSafeguardBtn').textContent = 'Save Changes';
      
      // Store safeguard ID for update
      document.getElementById('saveSafeguardBtn').setAttribute('data-safeguard-id', safeguardId);
      
      // Show modal
      const modal = new bootstrap.Modal(document.getElementById('addSafeguardModal'));
      modal.show();
    });
  });
  
  // Remove safeguard buttons
  const removeSafeguardBtns = document.querySelectorAll('.remove-safeguard-btn');
  removeSafeguardBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      const safeguardName = this.getAttribute('data-safeguard-name');
      
      if (confirm(`Are you sure you want to remove the safeguard "${safeguardName}"?`)) {
        removeSafeguard(safeguardId);
      }
    });
  });
  
  // Scan for vulnerabilities button
  const scanBtns = document.querySelectorAll('#scanComponentBtn, #scanForVulnerabilitiesBtn');
  scanBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const componentId = window.location.pathname.split('/').pop();
      window.location.href = `/vulnerabilities/scan?component_id=${componentId}`;
    });
  });
  
  // Check for cancel and save buttons that might be added dynamically
  document.addEventListener('click', function(event) {
    if (event.target && event.target.id === 'cancelComponentEdit') {
      cancelComponentEdit();
    } else if (event.target && event.target.id === 'saveComponentEdit') {
      saveComponentEdit();
    }
  });

  // -- Reference Architecture handlers --
  // Load categories into dropdown
  async function loadRefArchCategories() {
    const sel = document.getElementById('refArchCategory');
    sel.innerHTML = '<option value="">Select category…</option>';
    const res = await fetch('/api/reference-architecture/categories');
    const cats = await res.json();
    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      sel.append(o);
    });
  }

  // Populate options on category change
  document.getElementById('refArchCategory')
    .addEventListener('change', async function() {
      const optsSel = document.getElementById('refArchOption');
      optsSel.innerHTML = '<option value="">Select option…</option>';
      optsSel.disabled = !this.value;
      if (!this.value) return;
      const res = await fetch(`/api/reference-architecture/options?category=${this.value}`);
      const opts = await res.json();
      opts.forEach(o => {
        const el = document.createElement('option');
        el.value = o.id; el.textContent = o.name;
        optsSel.append(el);
      });
      optsSel.disabled = false;
    });

  // Open Reference Architecture modal
  document.querySelectorAll('.refarch-btn').forEach(btn =>
    btn.addEventListener('click', async function() {
      const componentId = window.location.pathname.split('/').pop();
      const sid = this.getAttribute('data-safeguard-id');
      const sname = this.getAttribute('data-safeguard-name');
      document.getElementById('refArchModalLabel').textContent = `Configure Reference Architecture: ${sname}`;
      document.getElementById('refArchSafeguardId').value = sid;
      const categorySel = document.getElementById('refArchCategory');
      const optionSel = document.getElementById('refArchOption');
      const colorSel = document.getElementById('refArchColor');
      // Reset dropdowns
      categorySel.innerHTML = '<option value="">Select category…</option>';
      optionSel.innerHTML = '<option value="">Select option…</option>';
      optionSel.disabled = true;
      colorSel.value = 'green';
      // Load categories
      const cats = await fetch('/api/reference-architecture/categories').then(r => r.json());
      cats.forEach(c => {
        const o = document.createElement('option'); o.value = c.id; o.textContent = c.name;
        categorySel.append(o);
      });
      // Fetch saved selection
      const saved = await fetch(
        `/api/reference-architecture/components/${componentId}/safeguards/${sid}/reference-architecture`
      ).then(r => r.json());
      if (saved && saved.categoryId) {
        categorySel.value = saved.categoryId;
        // Load corresponding options
        optionSel.innerHTML = '<option value="">Select option…</option>';
        const opts = await fetch(`/api/reference-architecture/options?category=${saved.categoryId}`).then(r => r.json());
        opts.forEach(o => {
          const el = document.createElement('option'); el.value = o.id; el.textContent = o.name;
          optionSel.append(el);
        });
        optionSel.disabled = false;
        optionSel.value = saved.optionId;
        colorSel.value = saved.color;
      }
      new bootstrap.Modal(document.getElementById('refArchModal')).show();
    })
  );

  // Save Reference Architecture selection
  document.getElementById('saveRefArchBtn')
    .addEventListener('click', async function() {
      const btn = this; const orig = btn.innerHTML;
      const componentId = window.location.pathname.split('/').pop();
      const safeguardId = document.getElementById('refArchSafeguardId').value;
      const categoryId = document.getElementById('refArchCategory').value;
      const optionId = document.getElementById('refArchOption').value;
      const color = document.getElementById('refArchColor').value;
      if (!categoryId || !optionId) { showAlert('Category & Option required', 'warning'); return; }
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving…'; btn.disabled = true;
      try {
        const res = await fetch(
          `/api/reference-architecture/components/${componentId}/safeguards/${safeguardId}/reference-architecture`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId, optionId, color })
          }
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown');
        showAlert('Reference Architecture saved', 'success');
        bootstrap.Modal.getInstance(document.getElementById('refArchModal')).hide();
      } catch (err) {
        showAlert(`Error: ${err.message}`, 'danger');
      } finally {
        btn.innerHTML = orig; btn.disabled = false;
      }
    });
});

/**
 * Toggle component overview section between view and edit modes
 */
function toggleComponentEdit() {
  const componentOverviewCard = document.querySelector('.card-body');
  const editBtn = document.getElementById('editComponentDetailsBtn');
  
  // Check if we're already in edit mode
  if (editBtn.getAttribute('data-editing') === 'true') {
    return; // Already in edit mode
  }
  
  // Get current component data
  const componentName = document.querySelector('.col-md-8 h3').textContent;
  const componentDescription = document.querySelector('.col-md-8 p.mb-3').textContent;
  const componentType = document.querySelector('.col-md-8 .row.mb-3 .col-md-4:nth-child(1) span').textContent.trim();
  const componentVersion = document.querySelector('.col-md-8 .row.mb-3 .col-md-4:nth-child(2) p').textContent;
  const isReusable = document.querySelector('.col-md-8 .row.mb-3 .col-md-4:nth-child(3) p').textContent.trim() === 'Yes';
  
  // Get tags
  const tagsContainer = document.querySelector('.col-md-8 .row .col-md-4:nth-child(3) div');
  let tags = [];
  if (!tagsContainer.querySelector('.text-muted')) {
    const tagElements = tagsContainer.querySelectorAll('.badge');
    tags = Array.from(tagElements).map(el => el.textContent.trim());
  }
  
  console.log('Current data:', {
    componentName,
    componentDescription,
    componentType,
    componentVersion,
    isReusable,
    tags
  });
  
  // Store original content for cancel operation
  editBtn.setAttribute('data-original-content', componentOverviewCard.innerHTML);
  
  // Create edit form
  const editForm = document.createElement('form');
  editForm.id = 'componentEditForm';
  editForm.className = 'row g-3';
  
  // Component name and description
  editForm.innerHTML = `
    <div class="col-md-12 mb-3">
      <label for="editComponentName" class="form-label">Component Name</label>
      <input type="text" class="form-control" id="editComponentName" value="${componentName}">
    </div>
    <div class="col-md-12 mb-3">
      <label for="editComponentDescription" class="form-label">Description</label>
      <textarea class="form-control" id="editComponentDescription" rows="3">${componentDescription}</textarea>
    </div>
    <div class="col-md-4 mb-3">
      <label for="editComponentType" class="form-label">Type</label>
      <select class="form-select" id="editComponentType">
        <option value="Web Application" ${componentType === 'Web Application' ? 'selected' : ''}>Web Application</option>
        <option value="Mobile Application" ${componentType === 'Mobile Application' ? 'selected' : ''}>Mobile Application</option>
        <option value="API" ${componentType === 'API' ? 'selected' : ''}>API</option>
        <option value="Desktop Application" ${componentType === 'Desktop Application' ? 'selected' : ''}>Desktop Application</option>
        <option value="Database" ${componentType === 'Database' ? 'selected' : ''}>Database</option>
        <option value="Server" ${componentType === 'Server' ? 'selected' : ''}>Server</option>
        <option value="Network" ${componentType === 'Network' ? 'selected' : ''}>Network</option>
        <option value="System" ${componentType === 'System' ? 'selected' : ''}>System</option>
      </select>
    </div>
    <div class="col-md-4 mb-3">
      <label for="editComponentVersion" class="form-label">Version</label>
      <input type="text" class="form-control" id="editComponentVersion" value="${componentVersion}">
    </div>
    <div class="col-md-4 mb-3">
      <label for="editIsReusable" class="form-label">Reusable</label>
      <select class="form-select" id="editIsReusable">
        <option value="true" ${isReusable ? 'selected' : ''}>Yes</option>
        <option value="false" ${!isReusable ? 'selected' : ''}>No</option>
      </select>
    </div>
    <div class="col-md-12 mb-3">
      <label for="editComponentTags" class="form-label">Tags (comma separated)</label>
      <input type="text" class="form-control" id="editComponentTags" value="${tags.join(', ')}">
    </div>
    <div class="col-12 mt-3">
      <button type="button" class="btn btn-primary" id="saveComponentEdit">Save Changes</button>
      <button type="button" class="btn btn-secondary ms-2" id="cancelComponentEdit">Cancel</button>
    </div>
  `;
  
  // Replace content with form
  const componentContent = document.querySelector('.card-body .row .col-md-8');
  componentContent.innerHTML = '';
  componentContent.appendChild(editForm);
  
  // Update button state
  editBtn.setAttribute('data-editing', 'true');
  editBtn.style.display = 'none';
}

/**
 * Cancel component edit and restore original content
 */
function cancelComponentEdit() {
  const editBtn = document.getElementById('editComponentDetailsBtn');
  const componentOverviewCard = document.querySelector('.card-body');
  
  // Restore original content
  componentOverviewCard.innerHTML = editBtn.getAttribute('data-original-content');
  
  // Reset button state
  editBtn.removeAttribute('data-editing');
  editBtn.style.display = 'block';
}

/**
 * Save component edit changes
 */
function saveComponentEdit() {
  // Get form values
  const componentName = document.getElementById('editComponentName').value.trim();
  const componentDescription = document.getElementById('editComponentDescription').value.trim();
  const componentType = document.getElementById('editComponentType').value;
  const componentVersion = document.getElementById('editComponentVersion').value.trim();
  const isReusable = document.getElementById('editIsReusable').value === 'true';
  
  // Parse tags
  const tagsInput = document.getElementById('editComponentTags').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
  
  // Validate required fields
  if (!componentName) {
    showAlert('Component name is required', 'danger');
    return;
  }
  
  // Get component ID from URL
  const componentId = window.location.pathname.split('/').pop();
  
  // Create component data object
  const componentData = {
    name: componentName,
    description: componentDescription,
    type: componentType,
    version: componentVersion,
    is_reusable: isReusable,
    tags: tags
  };
  
  // Show loading indicator
  const saveBtn = document.getElementById('saveComponentEdit');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  saveBtn.disabled = true;
  
  console.log('Submitting component data:', componentData);
  
  // Submit update request
  fetch(`/api/components/${componentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(componentData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('Component details updated successfully!', 'success');
      // Reload page to show updated data
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Error updating component:', error);
    showAlert(`Error updating component: ${error.message}`, 'danger');
    
    // Reset button
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

/**
 * Save component changes from the edit modal
 */
function saveComponent() {
  // Get form values
  const componentName = document.getElementById('componentName').value.trim();
  const componentDescription = document.getElementById('componentDescription').value.trim();
  const componentType = document.getElementById('componentType').value;
  const componentVersion = document.getElementById('componentVersion').value.trim();
  const isReusable = document.getElementById('isReusable').checked;
  
  // Parse tags
  const tagsInput = document.getElementById('componentTags').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
  
  // Validate required fields
  if (!componentName) {
    showAlert('Component name is required', 'danger');
    return;
  }
  
  // Get component ID from URL
  const componentId = window.location.pathname.split('/').pop();
  
  // Create component data object
  const componentData = {
    name: componentName,
    description: componentDescription,
    type: componentType,
    version: componentVersion,
    is_reusable: isReusable,
    tags: tags
  };
  
  // Show loading indicator
  const saveBtn = document.getElementById('saveComponentBtn');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  saveBtn.disabled = true;
  
  // Submit update request
  fetch(`/api/components/${componentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(componentData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editComponentModal'));
      modal.hide();
      
      showAlert('Component updated successfully!', 'success');
      // Reload page after a short delay
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Error updating component:', error);
    showAlert(`Error updating component: ${error.message}`, 'danger');
    
    // Reset button
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

/**
 * Save safeguard to component
 */
function saveSafeguard() {
  // Get form values
  const safeguardName = document.getElementById('safeguardName').value.trim();
  const safeguardType = document.getElementById('safeguardType').value;
  const safeguardDescription = document.getElementById('safeguardDescription').value.trim();
  const implementationStatus = document.getElementById('implementationStatus').value;
  const implementationNotes = document.getElementById('implementationNotes').value.trim();
  
  // Validate required fields
  if (!safeguardName) {
    showAlert('Safeguard name is required', 'danger');
    return;
  }
  
  // Get component ID from URL
  const componentId = window.location.pathname.split('/').pop();
  
  // Check if we're updating an existing safeguard
  const saveBtn = document.getElementById('saveSafeguardBtn');
  const safeguardId = saveBtn.getAttribute('data-safeguard-id');
  
  // Create safeguard data
  const safeguardData = {
    name: safeguardName,
    type: safeguardType,
    description: safeguardDescription,
    status: implementationStatus,
    notes: implementationNotes
  };
  
  // Show loading indicator
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving…'; saveBtn.disabled = true;
  
  let url, method;
  
  if (safeguardId) {
    // Update existing safeguard
    url = `/api/components/${componentId}/safeguards/${safeguardId}`;
    method = 'PUT';
  } else {
    // Create new safeguard
    url = `/api/components/${componentId}/safeguards`;
    method = 'POST';
  }
  
  // Submit request
  fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(safeguardData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Hide modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('addSafeguardModal'));
      modal.hide();
      
      showAlert(`Safeguard ${safeguardId ? 'updated' : 'added'} successfully!`, 'success');
      // Reload page after a short delay
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Error saving safeguard:', error);
    showAlert(`Error saving safeguard: ${error.message}`, 'danger');
    
    // Reset button
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

/**
 * Remove safeguard from component
 */
function removeSafeguard(safeguardId) {
  // Get component ID from URL
  const componentId = window.location.pathname.split('/').pop();
  
  // Submit request
  fetch(`/api/components/${componentId}/safeguards/${safeguardId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('Safeguard removed successfully!', 'success');
      // Reload page after a short delay
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Error removing safeguard:', error);
    showAlert(`Error removing safeguard: ${error.message}`, 'danger');
  });
}

/**
 * Display an alert message in the alert container
 * @param {string} message - The message to display
 * @param {string} type - The alert type (success, danger, warning, info)
 */
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('componentDetailAlertContainer');
  if (!alertContainer) return;
  
  const alertElement = document.createElement('div');
  alertElement.className = `alert alert-${type} alert-dismissible fade show`;
  alertElement.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertElement);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    alertElement.classList.remove('show');
    setTimeout(() => alertElement.remove(), 150);
  }, 5000);
}
