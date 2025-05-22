/**
 * Fetch Request Interceptor
 * 
 * This script patches all fetch requests in the application to include credentials
 * and adds better error handling. This ensures that authentication cookies are
 * always sent with requests.
 */
(function() {
  console.log('Fetch interceptor loaded - patching all fetch requests to include credentials');
  
  // Store the original fetch function
  const originalFetch = window.fetch;
  
  // Replace fetch with our enhanced version
  window.fetch = function(url, options = {}) {
    // Always include credentials in every request
    const enhancedOptions = {
      ...options,
      credentials: 'include'
    };
    
    console.log(`Intercepted fetch to ${url} - adding credentials`);
    
    // Call the original fetch with our enhanced options
    return originalFetch(url, enhancedOptions)
      .then(response => {
        // Log response status for debugging
        console.log(`Response from ${url}: ${response.status} ${response.statusText}`);
        
        // Clone the response so we can both check it and return it
        const clonedResponse = response.clone();
        
        // For API requests, provide better error handling
        if (url.includes('/api/')) {
          if (!response.ok) {
            console.error(`API request failed: ${url} - ${response.status} ${response.statusText}`);
            
            // Try to get more error details if possible
            return clonedResponse.text()
              .then(text => {
                let errorMessage;
                try {
                  // Try to parse as JSON
                  const data = JSON.parse(text);
                  errorMessage = data.error || data.message || `Server responded with status: ${response.status}`;
                } catch (e) {
                  // If not JSON, use the text
                  errorMessage = text || `Server responded with status: ${response.status}`;
                }
                
                // Throw a detailed error
                throw new Error(errorMessage);
              })
              .catch(error => {
                // If we couldn't read the response, throw a generic error
                if (error.name === 'SyntaxError') {
                  throw new Error(`Server responded with status: ${response.status}`);
                }
                throw error;
              });
          }
        }
        
        // Return the original response for normal processing
        return response;
      })
      .catch(error => {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
      });
  };
  
  // Also patch XMLHttpRequest for legacy code
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    // Call the original open method
    originalOpen.apply(this, arguments);
    
    // Set withCredentials to true for all requests
    this.withCredentials = true;
    
    // Log for debugging
    console.log(`Intercepted XMLHttpRequest to ${url} - adding credentials`);
  };
  
  // Add a utility function to test authentication
  window.checkAuthentication = function() {
    return fetch('/api/status')
      .then(response => response.json())
      .then(data => {
        console.log('Authentication status:', data);
        return data;
      })
      .catch(error => {
        console.error('Authentication check failed:', error);
        throw error;
      });
  };
  
  // Add a utility function to test project creation directly
  window.testProjectCreation = function(projectName = 'Test Project') {
    const projectData = {
      name: projectName + ' ' + new Date().toISOString().slice(11, 19),
      description: 'Created by test function',
      business_unit: 'Testing',
      criticality: 'Medium',
      data_classification: 'Internal',
      status: 'Active'
    };
    
    console.log('Testing project creation with data:', projectData);
    
    return fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    })
    .then(response => response.json())
    .then(data => {
      console.log('Project creation result:', data);
      return data;
    });
  };
  
  // Test Auth & Project Creation button has been removed while preserving the core functionality
})();
