/**
 * Component Library Management
 * Handles interactions with the component library interface
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DataTables
  const componentsTable = $('#componentsTable').DataTable({
    responsive: true,
    order: [[4, 'desc']], // Sort by usage count by default
    pageLength: 10,
    language: {
      search: "_INPUT_",
      searchPlaceholder: "Search components..."
    }
  });
  
  // Add Component to Library
  document.getElementById('saveComponentBtn')?.addEventListener('click', function() {
    const form = document.getElementById('addComponentForm');
    const formData = new FormData(form);
    
    const componentData = {};
    formData.forEach((value, key) => {
      componentData[key] = value;
    });
    
    // Call API to add component to library
    fetch('/api/component-library', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(componentData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addComponentModal'));
        modal.hide();
        
        // Show success message
        showAlert('success', 'Component added to library successfully!');
        
        // Reload the page to show the new component
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Show error message
        showAlert('danger', `Error adding component to library: ${data.error}`);
      }
    })
    .catch(error => {
      // Show error message
      showAlert('danger', `Error adding component to library: ${error.message}`);
    });
  });
  
  // Add to Project Button
  const addToProjectButtons = document.querySelectorAll('.add-to-project-btn');
  addToProjectButtons.forEach(button => {
    button.addEventListener('click', function() {
      const componentId = this.getAttribute('data-component-id');
      const componentName = this.getAttribute('data-component-name');
      
      document.getElementById('componentIdToAdd').value = componentId;
      document.getElementById('componentNameToAdd').textContent = componentName;
      
      // Fetch projects for dropdown
      fetch('/api/projects')
        .then(response => response.json())
        .then(data => {
          const projectSelect = document.getElementById('projectSelect');
          projectSelect.innerHTML = '';
          
          if (data.projects && data.projects.length > 0) {
            data.projects.forEach(project => {
              const option = document.createElement('option');
              option.value = project.id;
              option.textContent = project.name;
              projectSelect.appendChild(option);
            });
          } else {
            projectSelect.innerHTML = '<option value="">No projects available</option>';
          }
        })
        .catch(error => {
          console.error('Error fetching projects:', error);
          const projectSelect = document.getElementById('projectSelect');
          projectSelect.innerHTML = '<option value="">Error loading projects</option>';
        });
    });
  });
  
  // Add Component to Project
  document.getElementById('addToProjectBtn')?.addEventListener('click', function() {
    const form = document.getElementById('addToProjectForm');
    const componentId = document.getElementById('componentIdToAdd').value;
    const projectId = document.getElementById('projectSelect').value;
    
    if (!projectId) {
      showAlert('warning', 'Please select a project');
      return;
    }
    
    fetch(`/api/projects/${projectId}/components`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        component_id: componentId,
        from_library: true
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addToProjectModal'));
        modal.hide();
        
        // Show success message
        showAlert('success', 'Component added to project successfully!');
        
        // Update the usage count in the table
        const row = componentsTable.row(function(idx, data, node) {
          return $(node).find(`button[data-component-id="${componentId}"]`).length > 0;
        });
        
        if (row.length) {
          const rowData = row.data();
          const usageCountCell = row.nodes().to$().find('td:eq(4)');
          const currentCount = parseInt(usageCountCell.text()) || 0;
          usageCountCell.text(currentCount + 1);
        }
      } else {
        // Show error message
        showAlert('danger', `Error adding component to project: ${data.error}`);
      }
    })
    .catch(error => {
      // Show error message
      showAlert('danger', `Error adding component to project: ${error.message}`);
    });
  });
  
  // Delete Component Button
  const deleteComponentButtons = document.querySelectorAll('.delete-component-btn');
  deleteComponentButtons.forEach(button => {
    button.addEventListener('click', function() {
      const componentId = this.getAttribute('data-component-id');
      const componentName = this.getAttribute('data-component-name');
      
      if (confirm(`Are you sure you want to delete the component "${componentName}" from the library?`)) {
        fetch(`/api/component-library/${componentId}`, {
          method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Show success message
            showAlert('success', 'Component deleted successfully!');
            
            // Remove the row from the table
            const row = componentsTable.row(button.closest('tr'));
            row.remove().draw();
          } else {
            // Show error message
            showAlert('danger', `Error deleting component: ${data.error}`);
          }
        })
        .catch(error => {
          // Show error message
          showAlert('danger', `Error deleting component: ${error.message}`);
        });
      }
    });
  });
  
  // View Component Button
  const viewComponentButtons = document.querySelectorAll('.view-component-btn');
  viewComponentButtons.forEach(button => {
    button.addEventListener('click', function() {
      const componentId = this.getAttribute('data-component-id');
      window.location.href = `/component-library/${componentId}`;
    });
  });
  
  // Import Components Button
  document.getElementById('importComponentsBtn')?.addEventListener('click', function() {
    // In a real implementation, this would open a modal to select components to import
    showAlert('info', 'Component import functionality will be implemented in a future release.');
  });
  
  // Helper function to show alerts
  function showAlert(type, message) {
    const alertContainer = document.getElementById('componentLibraryAlertContainer');
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'danger' ? 'exclamation-triangle' : 
                 type === 'warning' ? 'exclamation-circle' : 'info-circle';
    
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        <i class="bi bi-${icon} me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      const alert = alertContainer.querySelector('.alert');
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 5000);
  }
});
