/**
 * Project Creation Tester
 * 
 * This file previously contained UI for the Project Creation Tester.
 * UI elements have been removed, but utility functions are preserved for API compatibility.
 */
(function() {
  // Define utility functions for testing authentication and API status
  window.checkAuthStatus = function() {
    return fetch('/login-status', {
      credentials: 'include' // Include cookies
    })
    .then(response => response.json())
    .then(data => {
      console.log('Auth status:', data);
      return data;
    })
    .catch(error => {
      console.error('Error checking auth:', error);
      throw error;
    });
  };
  
  window.checkApiStatus = function() {
    return fetch('/api/status', {
      credentials: 'include' // Include cookies
    })
    .then(response => response.json())
    .then(data => {
      console.log('API status:', data);
      return data;
    })
    .catch(error => {
      console.error('Error checking API:', error);
      throw error;
    });
  };
  
  window.createTestProject = function(projectData, callback) {
    if (!projectData || !projectData.name) {
      console.error('Project creation error: Missing required name parameter');
      if (callback) callback({ success: false, error: 'Missing required name parameter' });
      return;
    }
    
    // Ensure all required fields
    const finalProjectData = {
      name: projectData.name,
      description: projectData.description || 'Created by test function',
      business_unit: projectData.business_unit || 'Testing',
      criticality: projectData.criticality || 'Medium',
      data_classification: projectData.data_classification || 'Internal',
      status: projectData.status || 'Active'
    };
    
    console.log('Submitting project data:', finalProjectData);
    
    return fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalProjectData),
      credentials: 'include'
    })
    .then(response => {
      console.log('Response status:', response.status);
      return response.json().catch(() => {
        throw new Error(`Server responded with status: ${response.status}`);
      });
    })
    .then(data => {
      console.log('Project creation response:', data);
      if (callback) callback(data);
      return data;
    })
    .catch(error => {
      console.error('Error creating project:', error);
      if (callback) callback({ success: false, error: error.message });
      throw error;
    });
  };
})();
