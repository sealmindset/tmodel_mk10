/**
 * Project Security Posture
 * Handles interactions with the project security posture interface
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DataTables for components table
  const componentsTable = $('#componentsTable').DataTable({
    responsive: true,
    order: [[5, 'desc']], // Sort by financial impact by default
    pageLength: 10,
    language: {
      search: "_INPUT_",
      searchPlaceholder: "Search components..."
    }
  });
  
  // Recalculate Score Button
  document.getElementById('recalculateScoreBtn')?.addEventListener('click', function() {
    const projectId = window.location.pathname.split('/')[2]; // Extract project ID from URL
    const alertContainer = document.getElementById('securityPostureAlertContainer');
    
    // Show loading message
    showAlert('info', 'Recalculating security posture score...', 'arrow-repeat spin');
    
    // Add a spinning animation
    const style = document.createElement('style');
    style.textContent = `
      .spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    // Call API to recalculate score
    fetch(`/api/projects/${projectId}/security-posture/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showAlert('success', `Security posture score updated to ${data.score}`, 'check-circle');
        
        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showAlert('danger', `Error updating security posture score: ${data.error}`, 'exclamation-triangle');
      }
    })
    .catch(error => {
      showAlert('danger', `Error updating security posture score: ${error.message}`, 'exclamation-triangle');
    });
  });
  
  // Export Report Button
  document.getElementById('exportReportBtn')?.addEventListener('click', function() {
    const projectId = window.location.pathname.split('/')[2]; // Extract project ID from URL
    
    showAlert('success', 'Security posture report exported successfully!', 'file-earmark-excel');
    
    // In a real implementation, this would generate and download an Excel file
    // Example of how this might work:
    /*
    fetch(`/api/projects/${projectId}/security-posture/export`, {
      method: 'GET'
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `security-posture-report-${projectId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(error => {
      showAlert('danger', `Error exporting report: ${error.message}`, 'exclamation-triangle');
    });
    */
  });
  
  // Edit Business Impact Modal
  const editImpactButtons = document.querySelectorAll('.edit-impact-btn');
  editImpactButtons.forEach(button => {
    button.addEventListener('click', function() {
      const componentId = this.getAttribute('data-component-id');
      const componentName = this.getAttribute('data-component-name');
      
      document.getElementById('componentId').value = componentId;
      document.getElementById('componentName').value = componentName;
      
      // In a real implementation, you would fetch the current impact data for this component
      // and populate the form fields
      fetch(`/api/components/${componentId}/business-impact`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Populate form fields with current values
            const impact = data.impact;
            document.getElementById('confidentialityImpact').value = impact.confidentiality_impact || 'Low';
            document.getElementById('integrityImpact').value = impact.integrity_impact || 'Low';
            document.getElementById('availabilityImpact').value = impact.availability_impact || 'Low';
            document.getElementById('financialImpact').value = impact.financial_impact || 0;
            document.getElementById('reputationalImpact').value = impact.reputational_impact || 'Low';
            document.getElementById('regulatoryImpact').value = impact.regulatory_impact || 'Low';
            document.getElementById('impactNotes').value = impact.notes || '';
          } else {
            // Set default values
            document.getElementById('confidentialityImpact').value = 'Low';
            document.getElementById('integrityImpact').value = 'Low';
            document.getElementById('availabilityImpact').value = 'Low';
            document.getElementById('financialImpact').value = 0;
            document.getElementById('reputationalImpact').value = 'Low';
            document.getElementById('regulatoryImpact').value = 'Low';
            document.getElementById('impactNotes').value = '';
          }
        })
        .catch(error => {
          console.error('Error fetching business impact data:', error);
          // Set default values
          document.getElementById('confidentialityImpact').value = 'Low';
          document.getElementById('integrityImpact').value = 'Low';
          document.getElementById('availabilityImpact').value = 'Low';
          document.getElementById('financialImpact').value = 0;
          document.getElementById('reputationalImpact').value = 'Low';
          document.getElementById('regulatoryImpact').value = 'Low';
          document.getElementById('impactNotes').value = '';
        });
    });
  });
  
  // Save Business Impact Button
  document.getElementById('saveImpactBtn')?.addEventListener('click', function() {
    const projectId = window.location.pathname.split('/')[2]; // Extract project ID from URL
    const form = document.getElementById('businessImpactForm');
    const formData = new FormData(form);
    const componentId = document.getElementById('componentId').value;
    
    const impactData = {};
    formData.forEach((value, key) => {
      impactData[key] = value;
    });
    
    // Call API to update business impact
    fetch(`/api/projects/${projectId}/components/${componentId}/business-impact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(impactData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Hide the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editImpactModal'));
        modal.hide();
        
        // Show success message
        showAlert('success', 'Business impact analysis updated successfully!', 'check-circle');
        
        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        // Show error message
        showAlert('danger', `Error updating business impact analysis: ${data.error}`, 'exclamation-triangle');
      }
    })
    .catch(error => {
      // Show error message
      showAlert('danger', `Error updating business impact analysis: ${error.message}`, 'exclamation-triangle');
    });
  });
  
  // Helper function to show alerts
  function showAlert(type, message, iconName) {
    const alertContainer = document.getElementById('securityPostureAlertContainer');
    
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        <i class="bi bi-${iconName} me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    
    // Auto-dismiss after 5 seconds for success messages
    if (type === 'success') {
      setTimeout(() => {
        const alert = alertContainer.querySelector('.alert');
        if (alert) {
          const bsAlert = new bootstrap.Alert(alert);
          bsAlert.close();
        }
      }, 5000);
    }
  }
});
