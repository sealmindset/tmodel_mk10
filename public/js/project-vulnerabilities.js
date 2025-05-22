/**
 * Project Vulnerabilities JavaScript
 * 
 * Handles client-side functionality for the project vulnerabilities page
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize DataTable for vulnerabilities
  const vulnerabilitiesTable = $('#vulnerabilitiesTable').DataTable({
    order: [[0, 'desc']],
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    responsive: true,
    columnDefs: [
      { targets: 'no-sort', orderable: false }
    ]
  });

  // Handle sync vulnerabilities button
  const syncVulnerabilitiesBtn = document.getElementById('syncVulnerabilitiesBtn');
  if (syncVulnerabilitiesBtn) {
    syncVulnerabilitiesBtn.addEventListener('click', function() {
      const projectId = this.dataset.projectId;
      syncVulnerabilities(projectId);
    });
  }

  // Handle status update buttons
  document.querySelectorAll('.update-vulnerability-status').forEach(button => {
    button.addEventListener('click', function() {
      const vulnerabilityId = this.dataset.vulnerabilityId;
      const currentStatus = this.dataset.currentStatus;
      showStatusUpdateModal(vulnerabilityId, currentStatus);
    });
  });

  // Handle status update form submission
  const vulnerabilityStatusForm = document.getElementById('vulnerabilityStatusForm');
  if (vulnerabilityStatusForm) {
    vulnerabilityStatusForm.addEventListener('submit', function(e) {
      e.preventDefault();
      updateVulnerabilityStatus();
    });
  }
});

/**
 * Sync vulnerabilities for a project
 * @param {string} projectId - The project ID
 */
function syncVulnerabilities(projectId) {
  // Show loading indicator
  const syncBtn = document.getElementById('syncVulnerabilitiesBtn');
  const originalText = syncBtn.innerHTML;
  syncBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Syncing...';
  syncBtn.disabled = true;

  // Call API to sync vulnerabilities
  fetch(`/enterprise-architecture/api/projects/${projectId}/sync-vulnerabilities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('success', `Vulnerabilities synced successfully. Found ${data.count} vulnerabilities.`);
      // Reload the page to show updated vulnerabilities
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showAlert('danger', `Error syncing vulnerabilities: ${data.error}`);
      syncBtn.innerHTML = originalText;
      syncBtn.disabled = false;
    }
  })
  .catch(error => {
    console.error('Error syncing vulnerabilities:', error);
    showAlert('danger', 'Error syncing vulnerabilities. Please try again.');
    syncBtn.innerHTML = originalText;
    syncBtn.disabled = false;
  });
}

/**
 * Show status update modal
 * @param {string} vulnerabilityId - The vulnerability ID
 * @param {string} currentStatus - The current status
 */
function showStatusUpdateModal(vulnerabilityId, currentStatus) {
  const modal = document.getElementById('updateStatusModal');
  const vulnerabilityIdInput = document.getElementById('vulnerabilityId');
  const statusSelect = document.getElementById('vulnerabilityStatus');
  
  vulnerabilityIdInput.value = vulnerabilityId;
  
  // Set current status as selected
  for (let i = 0; i < statusSelect.options.length; i++) {
    if (statusSelect.options[i].value === currentStatus) {
      statusSelect.selectedIndex = i;
      break;
    }
  }
  
  // Show modal
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
}

/**
 * Update vulnerability status
 */
function updateVulnerabilityStatus() {
  const vulnerabilityId = document.getElementById('vulnerabilityId').value;
  const status = document.getElementById('vulnerabilityStatus').value;
  const notes = document.getElementById('vulnerabilityNotes').value;
  
  // Call API to update status
  fetch(`/enterprise-architecture/api/vulnerabilities/${vulnerabilityId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status,
      notes
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Hide modal
      const modal = document.getElementById('updateStatusModal');
      const bsModal = bootstrap.Modal.getInstance(modal);
      bsModal.hide();
      
      showAlert('success', 'Vulnerability status updated successfully.');
      
      // Reload the page to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showAlert('danger', `Error updating vulnerability status: ${data.error}`);
    }
  })
  .catch(error => {
    console.error('Error updating vulnerability status:', error);
    showAlert('danger', 'Error updating vulnerability status. Please try again.');
  });
}

/**
 * Show alert message
 * @param {string} type - Alert type (success, danger, etc.)
 * @param {string} message - Alert message
 */
function showAlert(type, message) {
  const alertContainer = document.getElementById('vulnerabilitiesAlertContainer');
  const alertHtml = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  alertContainer.innerHTML = alertHtml;
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const alert = document.querySelector('.alert');
    if (alert) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }
  }, 5000);
}
