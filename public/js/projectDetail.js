/**
 * Project Detail Page JavaScript
 * Handles dynamic functionality for the project detail view
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize project overview edit functionality
  const editProjectDetailsBtn = document.getElementById('editProjectDetailsBtn');
  if (editProjectDetailsBtn) {
    editProjectDetailsBtn.addEventListener('click', function() {
      toggleProjectEdit();
    });
  }
  
  // Initialize component form toggle
  const isThirdPartyCheckbox = document.getElementById('isThirdParty');
  if (isThirdPartyCheckbox) {
    isThirdPartyCheckbox.addEventListener('change', function() {
      const thirdPartyFields = document.getElementById('thirdPartyFields');
      thirdPartyFields.style.display = this.checked ? 'block' : 'none';
    });
  }
  
  // Component buttons open the same modal
  const addComponentBtns = document.querySelectorAll('#addComponentBtn, #addComponentBtn2, #addFirstComponentBtn');
  addComponentBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = new bootstrap.Modal(document.getElementById('addComponentModal'));
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
  
  // New threat model button
  const newThreatModelBtn = document.getElementById('newThreatModelBtn');
  if (newThreatModelBtn) {
    newThreatModelBtn.addEventListener('click', function() {
      // Redirect to the simpler create page instead of the project-specific form
      window.location.href = '/create';
    });
  }
  
  // Scan project button
  const scanProjectBtn = document.getElementById('scanProjectBtn');
  if (scanProjectBtn) {
    scanProjectBtn.addEventListener('click', function() {
      const projectId = window.location.pathname.split('/').pop();
      window.location.href = `/vulnerabilities/scan?project_id=${projectId}`;
    });
  }
  
  // Clone model buttons
  const cloneModelBtns = document.querySelectorAll('.clone-model-btn');
  cloneModelBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const modelId = this.getAttribute('data-model-id');
      cloneThreatModel(modelId);
    });
  });
  
  // Initialize vulnerability chart if canvas exists
  initVulnerabilityChart();
  
  // Check for cancel and save buttons that might be added dynamically
  document.addEventListener('click', function(event) {
    if (event.target && event.target.id === 'cancelProjectEdit') {
      cancelProjectEdit();
    } else if (event.target && event.target.id === 'saveProjectEdit') {
      saveProjectEdit();
    }
  });
});

/**
 * Saves a new component and links it to the current project
 */
function saveComponent() {
  const name = document.getElementById('componentName').value.trim();
  if (!name) {
    showAlert('Component name is required', 'danger');
    return;
  }
  
  // Parse tags
  const tagsInput = document.getElementById('componentTags').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];
  
  const componentData = {
    name: name,
    description: document.getElementById('componentDescription').value.trim(),
    type: document.getElementById('componentType').value,
    tags: tags,
    technology_stack: document.getElementById('componentTechnology').value.trim(),
    is_third_party: document.getElementById('isThirdParty').checked
  };
  
  if (componentData.is_third_party) {
    componentData.vendor = document.getElementById('vendorName').value.trim();
    componentData.version = document.getElementById('version').value.trim();
  }
  
  // Get project ID from URL
  const projectId = window.location.pathname.split('/').pop();
  
  // Submit component creation
  fetch('/api/components', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(componentData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Get the component ID
      const componentId = data.data.id;
      
      // Link component to project
      return fetch(`/api/projects/${projectId}/components`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          component_id: componentId
        })
      });
    } else {
      throw new Error(data.error || 'Failed to create component');
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Hide modal and refresh page
      const modal = bootstrap.Modal.getInstance(document.getElementById('addComponentModal'));
      modal.hide();
      showAlert('Component added successfully!', 'success');
      // Reload page after a short delay
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Failed to link component to project');
    }
  })
  .catch(error => {
    console.error('Error adding component:', error);
    showAlert(`Error adding component: ${error.message}`, 'danger');
  });
}

/**
 * Clones a threat model
 * @param {string} modelId - The ID of the threat model to clone
 */
function cloneThreatModel(modelId) {
  if (confirm('Are you sure you want to clone this threat model?')) {
    const projectId = window.location.pathname.split('/').pop();
    
    fetch(`/api/threat-models/${modelId}/clone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: projectId
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showAlert('Threat model cloned successfully!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    })
    .catch(error => {
      console.error('Error cloning threat model:', error);
      showAlert(`Error cloning threat model: ${error.message}`, 'danger');
    });
  }
}

/**
 * Initialize vulnerability severity chart
 */
function initVulnerabilityChart() {
  const vulnCtx = document.getElementById('vulnerabilitySeverityChart');
  if (!vulnCtx) return;
  
  // Get vulnerability data from the data attributes
  const criticalCount = parseInt(vulnCtx.getAttribute('data-critical') || 0);
  const highCount = parseInt(vulnCtx.getAttribute('data-high') || 0);
  const mediumCount = parseInt(vulnCtx.getAttribute('data-medium') || 0);
  const lowCount = parseInt(vulnCtx.getAttribute('data-low') || 0);
  
  const vulnData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      label: 'Vulnerabilities by Severity',
      data: [criticalCount, highCount, mediumCount, lowCount],
      backgroundColor: [
        'rgba(220, 53, 69, 0.7)',
        'rgba(255, 193, 7, 0.7)',
        'rgba(13, 202, 240, 0.7)',
        'rgba(25, 135, 84, 0.7)'
      ],
      borderColor: [
        'rgb(220, 53, 69)',
        'rgb(255, 193, 7)',
        'rgb(13, 202, 240)',
        'rgb(25, 135, 84)'
      ],
      borderWidth: 1
    }]
  };
  
  new Chart(vulnCtx, {
    type: 'doughnut',
    data: vulnData,
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right'
        },
        title: {
          display: true,
          text: 'Vulnerabilities by Severity'
        }
      }
    }
  });
}

/**
 * Toggle project overview section between view and edit modes
 */
function toggleProjectEdit() {
  const projectOverviewCard = document.querySelector('.card-body');
  const editBtn = document.getElementById('editProjectDetailsBtn');
  
  // Check if we're already in edit mode
  if (editBtn.getAttribute('data-editing') === 'true') {
    return; // Already in edit mode
  }
  
  // Get current project data
  const projectName = document.querySelector('.col-md-8 h3').textContent;
  const projectDescription = document.querySelector('.col-md-8 p.mb-3').textContent;
  const businessUnit = document.querySelector('.col-md-8 .row.mb-3 .col-md-4:nth-child(1) p').textContent;
  const criticality = document.querySelector('.col-md-8 .row.mb-3 .col-md-4:nth-child(2) span').textContent.trim();
  const dataClassification = document.querySelector('.col-md-8 .row.mb-3 .col-md-4:nth-child(3) p').textContent;
  const status = document.querySelector('.col-md-8 .row .col-md-4:nth-child(1) span').textContent.trim();
  
  console.log('Current data:', {
    projectName,
    projectDescription,
    businessUnit,
    criticality,
    dataClassification,
    status
  });
  
  // Store original content for cancel operation
  editBtn.setAttribute('data-original-content', projectOverviewCard.innerHTML);
  
  // Create edit form
  const editForm = document.createElement('form');
  editForm.id = 'projectEditForm';
  editForm.className = 'row g-3';
  
  // Project name and description
  editForm.innerHTML = `
    <div class="col-md-12 mb-3">
      <label for="editProjectName" class="form-label">Project Name</label>
      <input type="text" class="form-control" id="editProjectName" value="${projectName}">
    </div>
    <div class="col-md-12 mb-3">
      <label for="editProjectDescription" class="form-label">Description</label>
      <textarea class="form-control" id="editProjectDescription" rows="3">${projectDescription}</textarea>
    </div>
    <div class="col-md-4 mb-3">
      <label for="editBusinessUnit" class="form-label">Business Unit</label>
      <input type="text" class="form-control" id="editBusinessUnit" value="${businessUnit}">
    </div>
    <div class="col-md-4 mb-3">
      <label for="editCriticality" class="form-label">Criticality</label>
      <select class="form-select" id="editCriticality">
        <option value="Critical" ${criticality === 'Critical' ? 'selected' : ''}>Critical</option>
        <option value="High" ${criticality === 'High' ? 'selected' : ''}>High</option>
        <option value="Medium" ${criticality === 'Medium' ? 'selected' : ''}>Medium</option>
        <option value="Low" ${criticality === 'Low' ? 'selected' : ''}>Low</option>
      </select>
    </div>
    <div class="col-md-4 mb-3">
      <label for="editDataClassification" class="form-label">Data Classification</label>
      <select class="form-select" id="editDataClassification">
        <option value="PCI DSS" ${dataClassification === 'PCI DSS' ? 'selected' : ''}>PCI DSS</option>
        <option value="HIPAA" ${dataClassification === 'HIPAA' ? 'selected' : ''}>HIPAA</option>
        <option value="SOX" ${dataClassification === 'SOX' ? 'selected' : ''}>SOX</option>
        <option value="FDA" ${dataClassification === 'FDA' ? 'selected' : ''}>FDA</option>
        <option value="Ship to Address" ${dataClassification === 'Ship to Address' ? 'selected' : ''}>Ship to Address</option>
        <option value="Time Sensitive Information" ${dataClassification === 'Time Sensitive Information' ? 'selected' : ''}>Time Sensitive Information</option>
        <option value="Proprietary Information" ${dataClassification === 'Proprietary Information' ? 'selected' : ''}>Proprietary Information</option>
        <option value="Other: Top Secret" ${dataClassification === 'Other: Top Secret' ? 'selected' : ''}>Other: Top Secret</option>
        <option value="Other: Confidential" ${dataClassification === 'Other: Confidential' ? 'selected' : ''}>Other: Confidential</option>
        <option value="Other: Internal Use Only" ${dataClassification === 'Other: Internal Use Only' ? 'selected' : ''}>Other: Internal Use Only</option>
        <option value="Other: Public" ${dataClassification === 'Other: Public' ? 'selected' : ''}>Other: Public</option>
      </select>
    </div>
    <div class="col-md-4 mb-3">
      <label for="editStatus" class="form-label">Status</label>
      <select class="form-select" id="editStatus">
        <option value="Active" ${status === 'Active' ? 'selected' : ''}>Active</option>
        <option value="Planning" ${status === 'Planning' ? 'selected' : ''}>Planning</option>
        <option value="Development" ${status === 'Development' ? 'selected' : ''}>Development</option>
        <option value="Maintenance" ${status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
        <option value="Archived" ${status === 'Archived' ? 'selected' : ''}>Archived</option>
      </select>
    </div>
    <div class="col-12 mt-3">
      <button type="button" class="btn btn-primary" id="saveProjectEdit">Save Changes</button>
      <button type="button" class="btn btn-secondary ms-2" id="cancelProjectEdit">Cancel</button>
    </div>
  `;
  
  // Replace content with form
  const projectContent = document.querySelector('.card-body .row .col-md-8');
  projectContent.innerHTML = '';
  projectContent.appendChild(editForm);
  
  // Update button state
  editBtn.setAttribute('data-editing', 'true');
  editBtn.style.display = 'none';
}

/**
 * Cancel project edit and restore original content
 */
function cancelProjectEdit() {
  const editBtn = document.getElementById('editProjectDetailsBtn');
  const projectOverviewCard = document.querySelector('.card-body');
  
  // Restore original content
  projectOverviewCard.innerHTML = editBtn.getAttribute('data-original-content');
  
  // Reset button state
  editBtn.removeAttribute('data-editing');
  editBtn.style.display = 'block';
}

/**
 * Save project edit changes
 */
function saveProjectEdit() {
  // Get form values
  const projectName = document.getElementById('editProjectName').value.trim();
  const projectDescription = document.getElementById('editProjectDescription').value.trim();
  const businessUnit = document.getElementById('editBusinessUnit').value.trim();
  const criticality = document.getElementById('editCriticality').value;
  const dataClassification = document.getElementById('editDataClassification').value.trim();
  const status = document.getElementById('editStatus').value;
  
  // Validate required fields
  if (!projectName) {
    showAlert('Project name is required', 'danger');
    return;
  }
  
  // Get project ID from URL
  const projectId = window.location.pathname.split('/').pop();
  
  // Create project data object
  const projectData = {
    name: projectName,
    description: projectDescription,
    business_unit: businessUnit,
    criticality: criticality,
    data_classification: dataClassification,
    status: status
  };
  
  // Show loading indicator
  const saveBtn = document.getElementById('saveProjectEdit');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  saveBtn.disabled = true;
  
  console.log('Submitting project data:', projectData);
  
  // Submit update request
  fetch(`/api/projects/${projectId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(projectData)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('Project details updated successfully!', 'success');
      // Reload page to show updated data
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  })
  .catch(error => {
    console.error('Error updating project:', error);
    showAlert(`Error updating project: ${error.message}`, 'danger');
    
    // Reset button
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  });
}

/**
 * Display an alert message in the alert container
 * @param {string} message - The message to display
 * @param {string} type - The alert type (success, danger, warning, info)
 */
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('projectDetailAlertContainer');
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
