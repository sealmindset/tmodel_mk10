/**
 * Safeguard edit form handler
 * Uses the forms.js utility for robust form submission
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';
  console.log('Safeguard edit form initializing...');
  
  // Check if forms utility is loaded
  if (!window.formHandler) {
    console.error('Forms utility not loaded! Include utils/forms.js before this script.');
    return;
  }
  
  // Get form ID - handle dynamically based on current page
  const safeguardEditForm = document.querySelector('form[action^="/safeguards/"]');
  
  if (!safeguardEditForm) {
    console.error('Safeguard edit form not found');
    return;
  }
  
  // Set ID if not present (to work with our utility)
  if (!safeguardEditForm.id) {
    safeguardEditForm.id = 'safeguardEditForm';
    console.log('Added ID to safeguard edit form:', safeguardEditForm.id);
  }
  
  // Initialize the form handler with our configuration
  const formHandler = window.formHandler.init({
    formId: safeguardEditForm.id,
    debug: true, // Set to false in production
    messages: {
      success: 'Safeguard updated successfully!',
      error: 'Failed to update safeguard',
      processing: 'Updating safeguard...',
      networkError: 'Network error. Please try again.'
    },
    onSuccess: function(result) {
      console.log('Safeguard updated:', result);
      // Redirect to safeguards list after success
      setTimeout(() => {
        window.location.href = '/safeguards';
      }, 800);
    },
    onError: function(error) {
      console.error('Error updating safeguard:', error);
    }
  });

  console.log('Safeguard edit form handler initialized and ready');
});
