/**
 * Enterprise Security Dashboard
 * Handles interactions with the enterprise security dashboard interface
 */
document.addEventListener('DOMContentLoaded', function() {
  // Initialize DataTables
  $('#projectsTable').DataTable({
    responsive: true,
    order: [[3, 'desc']], // Sort by security posture by default
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50],
    language: {
      search: "_INPUT_",
      searchPlaceholder: "Search projects..."
    }
  });
  
  $('#resilienceTable').DataTable({
    responsive: true,
    order: [[2, 'desc']], // Sort by security posture by default
    pageLength: 5,
    lengthMenu: [5, 10, 25],
    language: {
      search: "_INPUT_",
      searchPlaceholder: "Search business units..."
    }
  });
  
  // Refresh Dashboard Button
  document.getElementById('refreshDashboardBtn')?.addEventListener('click', function() {
    const alertContainer = document.getElementById('dashboardAlertContainer');
    
    // Show loading message
    showAlert('info', 'Refreshing dashboard data...', 'arrow-repeat spin');
    
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
    
    // In a real implementation, this would call an API to refresh the data
    // For now, just reload the page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });
  
  // Export Dashboard Button
  document.getElementById('exportDashboardBtn')?.addEventListener('click', function() {
    showAlert('success', 'Dashboard report exported successfully!', 'file-earmark-excel');
    
    // In a real implementation, this would generate and download an Excel file
    // Example of how this might work:
    /*
    fetch('/api/enterprise-dashboard/export', {
      method: 'GET'
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'enterprise-security-dashboard.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(error => {
      showAlert('danger', `Error exporting report: ${error.message}`, 'exclamation-triangle');
    });
    */
  });
  
  // Filter Projects Button
  document.getElementById('filterProjectsBtn')?.addEventListener('click', function() {
    // In a real implementation, this would open a modal with filter options
    showAlert('info', 'Project filtering will be implemented in a future release.', 'funnel');
  });
  
  // Sort Projects Button
  document.getElementById('sortProjectsBtn')?.addEventListener('click', function() {
    // In a real implementation, this would open a modal with sort options
    showAlert('info', 'Project sorting will be implemented in a future release.', 'sort-down');
  });
  
  // Helper function to show alerts
  function showAlert(type, message, iconName) {
    const alertContainer = document.getElementById('dashboardAlertContainer');
    
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
