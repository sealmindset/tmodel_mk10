/**
 * Safeguard creation form handler
 * Uses the forms.js utility for robust form submission
 */

// Load forms utility
document.addEventListener('DOMContentLoaded', function() {
  'use strict';
  console.log('Safeguard form initializing...');
  
  // Check if forms utility is loaded
  if (!window.formHandler) {
    console.error('Forms utility not loaded! Include utils/forms.js before this script.');
    return;
  }
  
  // Initialize the form handler with our configuration
  const safeguardForm = window.formHandler.init({
    formId: 'safeguardForm',
    debug: true, // Set to false in production
    messages: {
      success: 'Safeguard created successfully!',
      error: 'Failed to create safeguard',
      processing: 'Creating safeguard...',
      networkError: 'Network error. Please try again.'
    },
    onSuccess: function(result) {
      console.log('Safeguard created:', result);
      // Additional success actions can go here
    },
    onError: function(error) {
      console.error('Error creating safeguard:', error);
      // Additional error handling can go here
    }
  });

  console.log('Safeguard form handler initialized and ready');
});

