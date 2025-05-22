/**
 * Safeguard Library Management
 * Handles interactions with the safeguard library interface
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DataTables
  const safeguardsTable = $('#safeguardsTable').DataTable({
    responsive: true,
    order: [[4, 'desc']], // Sort by usage count by default
    pageLength: 10,
    language: {
      search: "_INPUT_",
      searchPlaceholder: "Search safeguards..."
    }
  });
  
  // Add Safeguard to Library
  document.getElementById('saveSafeguardBtn')?.addEventListener('click', function() {
    const form = document.getElementById('addSafeguardForm');
    const formData = new FormData(form);
    
    const safeguardData = {};
    formData.forEach((value, key) => {
      safeguardData[key] = value;
    });
    
    // Call API to add safeguard to library
    fetch('/api/safeguard-library', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(safeguardData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addSafeguardModal'));
        modal.hide();
        
        // Show success message
        showAlert('success', 'Safeguard added to library successfully!');
        
        // Reload the page to show the new safeguard
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Show error message
        showAlert('danger', `Error adding safeguard to library: ${data.error}`);
      }
    })
    .catch(error => {
      // Show error message
      showAlert('danger', `Error adding safeguard to library: ${error.message}`);
    });
  });
  
  // Add to Project Button
  const addToProjectButtons = document.querySelectorAll('.add-to-project-btn');
  addToProjectButtons.forEach(button => {
    button.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      const safeguardName = this.getAttribute('data-safeguard-name');
      
      document.getElementById('safeguardIdToAdd').value = safeguardId;
      document.getElementById('safeguardNameToAdd').textContent = safeguardName;
      
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
  
  // Add Safeguard to Project
  document.getElementById('addToProjectBtn')?.addEventListener('click', function() {
    const form = document.getElementById('addToProjectForm');
    const safeguardId = document.getElementById('safeguardIdToAdd').value;
    const projectId = document.getElementById('projectSelect').value;
    
    if (!projectId) {
      showAlert('warning', 'Please select a project');
      return;
    }
    
    fetch(`/api/projects/${projectId}/safeguards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        safeguard_id: safeguardId,
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
        showAlert('success', 'Safeguard added to project successfully!');
        
        // Update the usage count in the table
        const row = safeguardsTable.row(function(idx, data, node) {
          return $(node).find(`button[data-safeguard-id="${safeguardId}"]`).length > 0;
        });
        
        if (row.length) {
          const rowData = row.data();
          const usageCountCell = row.nodes().to$().find('td:eq(4)');
          const currentCount = parseInt(usageCountCell.text()) || 0;
          usageCountCell.text(currentCount + 1);
        }
      } else {
        // Show error message
        showAlert('danger', `Error adding safeguard to project: ${data.error}`);
      }
    })
    .catch(error => {
      // Show error message
      showAlert('danger', `Error adding safeguard to project: ${error.message}`);
    });
  });
  
  // Delete Safeguard Button
  const deleteSafeguardButtons = document.querySelectorAll('.delete-safeguard-btn');
  deleteSafeguardButtons.forEach(button => {
    button.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      const safeguardName = this.getAttribute('data-safeguard-name');
      
      if (confirm(`Are you sure you want to delete the safeguard "${safeguardName}" from the library?`)) {
        fetch(`/api/safeguard-library/${safeguardId}`, {
          method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Show success message
            showAlert('success', 'Safeguard deleted successfully!');
            
            // Remove the row from the table
            const row = safeguardsTable.row(button.closest('tr'));
            row.remove().draw();
          } else {
            // Show error message
            showAlert('danger', `Error deleting safeguard: ${data.error}`);
          }
        })
        .catch(error => {
          // Show error message
          showAlert('danger', `Error deleting safeguard: ${error.message}`);
        });
      }
    });
  });
  
  // View Safeguard Button
  const viewSafeguardButtons = document.querySelectorAll('.view-safeguard-btn');
  viewSafeguardButtons.forEach(button => {
    button.addEventListener('click', function() {
      const safeguardId = this.getAttribute('data-safeguard-id');
      window.location.href = `/safeguard-library/${safeguardId}`;
    });
  });
  
  // Import Safeguards Button
  document.getElementById('importSafeguardsBtn')?.addEventListener('click', function() {
    // In a real implementation, this would open a modal to select safeguards to import
    showAlert('info', 'Safeguard import functionality will be implemented in a future release.');
  });
  
  // Effectiveness Range Input
  const effectivenessInput = document.getElementById('safeguardEffectiveness');
  if (effectivenessInput) {
    effectivenessInput.addEventListener('input', function() {
      // Update the display value if needed
      // This could be enhanced to show the current value
    });
  }
  
  // Helper function to show alerts
  function showAlert(type, message) {
    const alertContainer = document.getElementById('safeguardLibraryAlertContainer');
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
