/**
 * Robust Form Handler Utility
 * 
 * A comprehensive solution for handling form submissions with multiple fallback strategies
 * to ensure reliability across different scenarios and browser environments.
 * 
 * Features:
 * - Multiple submission paths (standard, button-triggered, keyboard)
 * - DOM observation for dynamically added/replaced forms
 * - Comprehensive error handling and user feedback
 * - Prevention of double-submissions
 * - Standardized toast notifications
 * 
 * @version 1.0.0
 */

/**
 * Initialize a form with robust submission handling
 * 
 * @param {Object} options Configuration options
 * @param {string} options.formId The ID of the form to handle (without #)
 * @param {Function} options.onSuccess Callback for successful submissions
 * @param {Function} options.onError Callback for failed submissions
 * @param {boolean} options.resetOnSuccess Whether to reset the form after successful submission
 * @param {boolean} options.validation Whether to use form validation
 * @param {boolean} options.debug Whether to output detailed logs
 * @param {Object} options.messages Custom messages for user feedback
 * @returns {Object} API for interacting with the form handler
 */
function initFormHandler(options) {
  const settings = Object.assign({
    formId: null,
    onSuccess: null,
    onError: null,
    resetOnSuccess: true,
    validation: true,
    debug: false,
    messages: {
      success: 'Form submitted successfully',
      error: 'Failed to submit form',
      processing: 'Processing...',
      networkError: 'Network error. Please try again.'
    }
  }, options);

  if (!settings.formId) {
    console.error('[FormHandler] No form ID provided');
    return null;
  }

  const log = settings.debug ? 
    (msg, ...args) => console.log(`[FormHandler:${settings.formId}] ${msg}`, ...args) :
    () => {};

  log('Initializing form handler with settings:', settings);

  // Submission state
  let submissionState = {
    inProgress: false,
    lastSubmitted: 0,
    submitted: false
  };

  /**
   * Process form data into JSON
   * @param {HTMLFormElement} form The form element
   * @returns {Object} Processed form data as JSON object
   */
  function processFormData(form) {
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => { 
      // Handle multiple values for the same key (like checkboxes)
      if (data[key] !== undefined) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    log('Processed form data:', data);
    return data;
  }

  /**
   * Show toast notification
   * @param {string} message Message to display
   * @param {string} type Message type (success, danger, info, warning)
   */
  function showToast(message, type) {
    log(`Showing ${type} toast: ${message}`);
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-bg-${type} border-0 mb-2`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                data-bs-dismiss="toast" aria-label="Close"></button>
      </div>`;
    
    // Find or create toast container
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }
    
    // Show toast with Bootstrap if available, fallback to setTimeout
    toastContainer.appendChild(toast);
    try {
      const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
      bsToast.show();
      toast.addEventListener('hidden.bs.toast', () => toast.remove());
    } catch (err) {
      log('Bootstrap Toast unavailable, using fallback', err);
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  }

  /**
   * Execute form submission via fetch API
   * @param {HTMLFormElement} form The form element
   * @param {Object|FormData} customData Optional custom data to submit instead of form data
   * @returns {Promise} Submission promise
   */
  function submitForm(form, customData = null) {
    // Prevent double submissions
    if (submissionState.inProgress) {
      log('Submission already in progress, ignoring');
      return Promise.reject(new Error('Submission in progress'));
    }
    
    submissionState.inProgress = true;
    submissionState.submitted = true;
    
    // Show processing feedback
    showToast(settings.messages.processing, 'info');
    
    // Get form data
    const data = customData || processFormData(form);
    const url = form.action || window.location.href;
    const method = form.method || 'POST';
    
    log(`Submitting ${method} to ${url}`, data);
    
    // Execute fetch
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(response => {
      log('Response status:', response.status);
      
      // Try to parse response as JSON, fallback to empty object
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const dataPromise = isJson 
        ? response.json().catch(() => ({})) 
        : Promise.resolve({});
      
      return dataPromise.then(result => {
        if (response.ok) {
          // Success
          log('Success response:', result);
          showToast(result.message || settings.messages.success, 'success');
          
          if (settings.resetOnSuccess) {
            form.reset();
            if (form.classList.contains('was-validated')) {
              form.classList.remove('was-validated');
            }
          }
          
          if (typeof settings.onSuccess === 'function') {
            settings.onSuccess(result, form);
          }
          
          return result;
        } else {
          // Error with response
          log('Error response:', result);
          showToast(result.error || settings.messages.error, 'danger');
          
          if (typeof settings.onError === 'function') {
            settings.onError(result, form);
          }
          
          throw new Error(result.error || 'Submission failed');
        }
      });
    })
    .catch(err => {
      // Network error or JSON parsing error
      log('Fetch error:', err);
      showToast(settings.messages.networkError, 'danger');
      
      if (typeof settings.onError === 'function') {
        settings.onError({ error: err.message }, form);
      }
      
      throw err;
    })
    .finally(() => {
      submissionState.inProgress = false;
      submissionState.lastSubmitted = Date.now();
    });
  }

  /**
   * Attach all handlers to a form
   * @param {HTMLFormElement} form Form element to attach handlers to
   */
  function attachFormHandlers(form) {
    if (!form || form._handlersAttached) {
      return;
    }
    
    log('Attaching handlers to form:', form);
    
    // Mark that we've attached handlers to this form
    form._handlersAttached = true;
    
    // PRIMARY HANDLER: Standard form submit
    form.addEventListener('submit', function(e) {
      log('Form submit event fired');
      e.preventDefault();
      
      // Validate form if required
      if (settings.validation && typeof form.checkValidity === 'function') {
        if (!form.checkValidity()) {
          log('Form validation failed');
          form.classList.add('was-validated');
          return;
        }
      }
      
      submitForm(form);
    });
    
    // BACKUP HANDLER: Direct submit button handler
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) {
      log('Submit button found:', submitBtn);
      
      submitBtn.addEventListener('click', function(e) {
        log('Submit button clicked directly');
        
        // Store the timestamp to prevent double-submission
        const now = Date.now();
        const lastClick = submitBtn._lastClick || 0;
        submitBtn._lastClick = now;
        
        // Avoid multiple rapid clicks
        if (now - lastClick < 500) {
          log('Ignoring duplicate click');
          return;
        }
        
        // Wait a tiny bit to see if the normal submit event fires
        setTimeout(() => {
          if (!submissionState.submitted) {
            log('Form submit not detected, using manual submit');
            e.preventDefault();
            
            // Validate form if required
            if (settings.validation && typeof form.checkValidity === 'function') {
              if (!form.checkValidity()) {
                log('Form validation failed');
                form.classList.add('was-validated');
                return;
              }
            }
            
            submitForm(form);
          }
        }, 50);
      });
    } else {
      log('Warning: No submit button found in form!');
    }
  }

  // Initial form binding on DOMContentLoaded
  let formInitialized = false;
  
  function initialize() {
    if (formInitialized) return;
    
    // Find the form
    const form = document.getElementById(settings.formId);
    if (form) {
      log('Form found on initialization');
      attachFormHandlers(form);
      formInitialized = true;
    } else {
      log('Form not found during initialization, will observe DOM');
    }
    
    // Set up global event delegation
    document.addEventListener('submit', function(e) {
      if (e.target && e.target.id === settings.formId) {
        log('Global submit event captured');
      }
    }, true);
    
    // Use MutationObserver to detect if the form gets added after load
    const observer = new MutationObserver(function(mutations) {
      if (formInitialized) return;
      
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(function(node) {
            if (node.id === settings.formId) {
              log('Form directly added to DOM:', node);
              attachFormHandlers(node);
              formInitialized = true;
            } else if (node.querySelector && node.querySelector(`#${settings.formId}`)) {
              const form = node.querySelector(`#${settings.formId}`);
              log('Form found inside added node:', form);
              attachFormHandlers(form);
              formInitialized = true;
            }
          });
        }
      });
    });
    
    // Start observing the document
    observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
    
    // Also try a direct submit approach when Enter is pressed in any field
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target.form && e.target.form.id === settings.formId) {
        const form = e.target.form;
        log('Enter pressed in form field, triggering manual submission');
        e.preventDefault();
        
        // Validate form if required
        if (settings.validation && typeof form.checkValidity === 'function') {
          if (!form.checkValidity()) {
            log('Form validation failed');
            form.classList.add('was-validated');
            return;
          }
        }
        
        submitForm(form);
      }
    });
    
    // Just in case, recheck for the form after a short delay
    setTimeout(function() {
      if (formInitialized) return;
      
      const delayedForm = document.getElementById(settings.formId);
      if (delayedForm && !delayedForm._handlersAttached) {
        log('Found form after delay, attaching handlers');
        attachFormHandlers(delayedForm);
        formInitialized = true;
      }
    }, 500);
  }

  // Initialize on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Return public API
  return {
    /**
     * Manually submit the form
     * @param {Object} customData Optional custom data to submit
     * @returns {Promise} Submission promise
     */
    submit: function(customData = null) {
      const form = document.getElementById(settings.formId);
      if (!form) {
        return Promise.reject(new Error(`Form ${settings.formId} not found`));
      }
      return submitForm(form, customData);
    },
    
    /**
     * Reset the form
     * @returns {boolean} Success
     */
    reset: function() {
      const form = document.getElementById(settings.formId);
      if (!form) return false;
      form.reset();
      if (form.classList.contains('was-validated')) {
        form.classList.remove('was-validated');
      }
      return true;
    },
    
    /**
     * Check if form exists in DOM
     * @returns {boolean} Whether form exists
     */
    exists: function() {
      return !!document.getElementById(settings.formId);
    },
    
    /**
     * Get form data as object
     * @returns {Object|null} Form data or null if form not found
     */
    getData: function() {
      const form = document.getElementById(settings.formId);
      if (!form) return null;
      return processFormData(form);
    }
  };
}

// Export the utility
window.formHandler = { init: initFormHandler };
