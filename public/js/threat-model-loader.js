/**
 * Threat Model Loader
 * 
 * This script ensures the threat model components are properly loaded
 * and handles the initialization of the threat model assignment UI.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Threat model loader initialized');
  
  // First check if React and ReactDOM are available
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('React or ReactDOM is not available, loading them first');
    // Load React dependencies first
    Promise.all([
      loadScript('https://unpkg.com/react@17/umd/react.production.min.js'),
      loadScript('https://unpkg.com/react-dom@17/umd/react-dom.production.min.js')
    ])
    .then(() => {
      console.log('React dependencies loaded successfully');
      loadComponentScripts();
    })
    .catch(error => {
      console.error('Failed to load React dependencies:', error);
      showErrorMessage('Failed to load React dependencies. Please refresh the page and try again.');
    });
  } else {
    console.log('React dependencies already available');
    loadComponentScripts();
  }
  
  // Function to load our component scripts
  function loadComponentScripts() {
    // Load React components in the correct order
    loadScript('/js/components/ThreatModelAssignments.js')
      .then(() => loadScript('/js/components/AssignThreatModelsModal.js'))
      .then(() => {
        console.log('Threat model components loaded successfully');
        initializeThreatModelAssignments();
      })
      .catch(error => {
        console.error('Error loading threat model components:', error);
        showErrorMessage();
      });
  }
  
  // Helper function to load scripts in sequence
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
  }
  
  // Initialize the threat model assignments component
  function initializeThreatModelAssignments() {
    // Get project ID from the URL
    const pathParts = window.location.pathname.split('/');
    const projectId = pathParts[pathParts.indexOf('projects') + 1];
    
    if (!projectId) {
      console.error('Could not determine project ID from URL');
      return;
    }
    
    // Initialize the ThreatModelAssignments component if the container exists
    const container = document.getElementById('threatModelAssignmentsContainer');
    if (container && window.ComponentLoader && window.ThreatModelAssignments) {
      console.log('Rendering ThreatModelAssignments component with project ID:', projectId);
      
      // Use the component loader to safely render the component
      window.ComponentLoader.render('ThreatModelAssignments', container, { projectId });
    } else {
      console.error('Component loader or ThreatModelAssignments not available');
      showErrorMessage();
    }
  }
  
  // Show error message if components fail to load
  function showErrorMessage(customMessage) {
    const container = document.getElementById('threatModelAssignmentsContainer');
    if (container) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>
          ${customMessage || 'Unable to load Threat Model Assignments component.'}
          <button class="btn btn-sm btn-outline-primary ms-3" onclick="window.location.reload()">
            Refresh Page
          </button>
        </div>
      `;
    }
    
    // Log detailed error to console for debugging
    console.error('Component loading error details:', {
      'React available': typeof React !== 'undefined',
      'ReactDOM available': typeof ReactDOM !== 'undefined',
      'ComponentLoader available': typeof window.ComponentLoader !== 'undefined',
      'ThreatModelAssignments available': typeof window.ThreatModelAssignments !== 'undefined'
    });
  }
});
