/**
 * Safeguard Assignments Module
 * 
 * This module provides the functionality for assigning safeguards to components
 * using the reusable assignment pattern.
 */

// Safeguard Assignments Module (legacy static modal logic removed)
// This module is now a stub. All assignment logic is handled by reusable-assign-safeguards-modal.js.

document.addEventListener('DOMContentLoaded', function() {
  console.log('Safeguard assignment module loaded (static modal logic removed)');
  // If you need to trigger the dynamic modal, use openAssignSafeguardsModal from reusable-assign-safeguards-modal.js
  // Example:
  // openAssignSafeguardsModal({ componentId: '...', onAssigned: () => { ... } });
});

/**
 * Initialize event listeners for safeguard removal buttons
 */
function initSafeguardRemovalButtons() {
  document.querySelectorAll('.remove-safeguard-btn').forEach(button => {
    button.addEventListener('click', async function(event) {
      event.preventDefault();
      const safeguardId = this.getAttribute('data-safeguard-id');
      const safeguardName = this.getAttribute('data-safeguard-name');
      const componentId = document.querySelector('[data-component-id]')?.getAttribute('data-component-id');
      if (!componentId || !safeguardId) {
        console.error('Missing component ID or safeguard ID');
        return;
      }
      if (confirm(`Are you sure you want to remove safeguard "${safeguardName}" from this component?`)) {
        await removeSafeguardFromComponent(componentId, safeguardId);
      }
    });
  });
}

/**
 * Remove a safeguard from a component
 * @param {string} componentId - The ID of the component
 * @param {string} safeguardId - The ID of the safeguard to remove
 * @returns {Promise<boolean>} - Whether removal was successful
 */
async function removeSafeguardFromComponent(componentId, safeguardId) {
  try {    
    // Call the API to remove the safeguard
    const response = await fetch(`/api/components/${componentId}/safeguards/${safeguardId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      let errorMsg = 'Failed to remove safeguard';
      try {
        const data = await response.json();
        if (data.error) {
          errorMsg = data.error;
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      throw new Error(errorMsg);
    }
    
    // Get the response data
    const data = await response.json();
    
    if (data.success) {
      // Show success message in alert container if available, otherwise use browser alert
      const alertContainer = document.getElementById('componentDetailAlertContainer');
      if (alertContainer) {
        alertContainer.innerHTML = `
          <div class="alert alert-success alert-dismissible fade show" role="alert">
            Safeguard removed successfully!
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      } else {
        alert('Safeguard removed successfully!');
      }
      
      // Reload the page to update the safeguards list
      window.location.reload();
      return true;
    } else {
      throw new Error(data.error || 'Failed to remove safeguard');
    }
  } catch (error) {
    console.error('Error removing safeguard:', error);
    
    // Show error in alert container if available, otherwise use browser alert
    const alertContainer = document.getElementById('componentDetailAlertContainer');
    if (alertContainer) {
      alertContainer.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
          Error removing safeguard: ${error.message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `;
    } else {
      alert(`Error removing safeguard: ${error.message}`);
    }
    
    return false;
  }
}

// Initialize removal buttons when the document is ready
document.addEventListener('DOMContentLoaded', initSafeguardRemovalButtons);

// Export functions for global use
// window.openSafeguardAssignmentModal is now set in DOMContentLoaded above
window.removeSafeguardFromComponent = removeSafeguardFromComponent;
