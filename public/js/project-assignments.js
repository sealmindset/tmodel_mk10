/**
 * project-assignments.js
 * Initializes the threat model assignments component on the project detail page
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get project ID from the URL
  const pathParts = window.location.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  
  if (!projectId) {
    console.error('Could not determine project ID from URL');
    return;
  }
  
  // Initialize the ThreatModelAssignments component if the container exists
  const container = document.getElementById('threatModelAssignmentsContainer');
  if (container && window.ComponentLoader) {
    // Use the component loader to safely render the component
    window.ComponentLoader.render('ThreatModelAssignments', container, { projectId });
  } else if (container) {
    // Fallback if component loader is not available
    console.error('ComponentLoader is not available. Make sure it is loaded before this script.');
    container.innerHTML = '<div class="alert alert-warning">Unable to load Threat Model Assignments component. Please check the console for errors.</div>';
  }
});
