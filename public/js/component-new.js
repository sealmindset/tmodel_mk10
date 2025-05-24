/**
 * Component creation form handler
 * Uses the forms.js utility for robust form submission
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';
  console.log('Component creation form initializing...');
  
  // Check if forms utility is loaded
  if (!window.formHandler) {
    console.error('Forms utility not loaded! Include utils/forms.js before this script.');
    return;
  }
  
  // Initialize the form handler with our configuration
  const componentForm = window.formHandler.init({
    formId: 'componentForm',
    debug: true, // Set to false in production
    messages: {
      success: 'Component created successfully!',
      error: 'Failed to create component',
      processing: 'Creating component...',
      networkError: 'Network error. Please try again.'
    },
    onSuccess: function(result) {
      console.log('Component created:', result);
      // Redirect to components list after success
      setTimeout(() => {
        window.location.href = '/components';
      }, 800);
    },
    onError: function(error) {
      console.error('Error creating component:', error);
      // Additional error handling can go here
    }
  });

  console.log('Component creation form handler initialized and ready');
});
