/**
 * Direct Project Saver
 * 
 * This file previously contained UI for the Quick Project Creator.
 * UI elements have been removed, but core functionality is preserved for API compatibility.
 */
(function() {
  // Define direct project creation function without UI elements
  window.createDirectProject = function(projectName, componentName, callback) {
    if (!projectName || !componentName) {
      console.error('Project creation error: Missing required parameters');
      if (callback) callback({ success: false, error: 'Missing required parameters' });
      return;
    }
    
    // Simple project data
    const projectData = {
      name: projectName,
      description: 'Created programmatically',
      business_unit: 'Default',
      criticality: 'Medium',
      data_classification: 'Internal',
      status: 'Active',
      components: [
        {
          name: componentName,
          hostname: 'localhost',
          ip_address: '127.0.0.1',
          type: 'Web Application'
        }
      ]
    };
    
    // Save the project
    fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    })
    .then(response => {
      console.log('Response status:', response.status);
      return response.json().catch(() => {
        // If response is not JSON
        throw new Error(`Server responded with status: ${response.status}`);
      });
    })
    .then(data => {
      console.log('Project creation response:', data);
      if (callback) callback(data);
    })
    .catch(error => {
      console.error('Error creating project:', error);
      if (callback) callback({ success: false, error: error.message });
    });
  };
})();
