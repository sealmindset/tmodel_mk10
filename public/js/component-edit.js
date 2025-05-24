/**
 * Component edit form handler
 * Uses the forms.js utility for robust form submission
 */

document.addEventListener('DOMContentLoaded', function() {
  'use strict';
  console.log('Component edit form initializing...');
  
  // Check if forms utility is loaded
  if (!window.formHandler) {
    console.error('Forms utility not loaded! Include utils/forms.js before this script.');
    return;
  }
  
  // Get form from the page - use the ID we assigned in the template
  const editForm = document.getElementById('componentEditForm');
  
  if (!editForm) {
    console.error('Component edit form not found - looking for form with id "componentEditForm"');
    // Try a more general selector as fallback
    const fallbackForm = document.querySelector('form[action^="/components/"]');
    if (fallbackForm) {
      console.log('Found form with fallback selector:', fallbackForm);
      fallbackForm.id = 'componentEditForm';
      return window.formHandler.init({
        formId: 'componentEditForm',
        debug: true,
        messages: {
          success: 'Component updated successfully!',
          error: 'Failed to update component',
          processing: 'Updating component...',
          networkError: 'Network error. Please try again.'
        }
      });
    }
    return;
  }
  
  // Initialize the form handler with our configuration
  const formHandler = window.formHandler.init({
    formId: editForm.id,
    debug: true, // Set to false in production
    messages: {
      success: 'Component updated successfully!',
      error: 'Failed to update component',
      processing: 'Updating component...',
      networkError: 'Network error. Please try again.'
    },
    onSuccess: function(result) {
      console.log('Component updated:', result);
      // Redirect to components list after success
      setTimeout(() => {
        window.location.href = '/components';
      }, 800);
    },
    onError: function(error) {
      console.error('Error updating component:', error);
      // Additional error handling can go here
    }
  });

  console.log('Component edit form handler initialized and ready');
});
