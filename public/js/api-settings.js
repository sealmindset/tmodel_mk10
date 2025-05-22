/**
 * API Settings JavaScript
 * Handles API settings configuration and OpenAPI spec file uploads
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize Bootstrap tabs
  initTabs();
  
  // Initialize LLM Provider settings handlers
  initLLMProviderSettings();
  
  // Initialize OpenAI API settings handlers
  initOpenAISettings();
  
  // Initialize Ollama API settings handlers
  initOllamaSettings();
  
  // Initialize Rapid7 API settings handlers
  initRapid7Settings();
  
  // Initialize PostgreSQL settings handlers
  initPostgresqlSettings();
  
  // Initialize Redis settings handlers
  initRedisSettings();
  
  // Initialize password toggle buttons
  initPasswordToggles();
});

/**
 * Display the endpoints discovered from the OpenAPI specification
 * @param {Array} endpoints - Array of endpoint objects
 */
function displayEndpoints(endpoints) {
  if (!endpoints || !Array.isArray(endpoints) || endpoints.length === 0) {
    console.warn('No endpoints to display');
    return;
  }
  
  const endpointsContainer = document.getElementById('rapid7-endpoints-container');
  const endpointsList = document.getElementById('rapid7-endpoints-list');
  
  if (!endpointsContainer || !endpointsList) {
    console.warn('Endpoints container or list not found');
    return;
  }
  
  // Clear previous endpoints
  endpointsList.innerHTML = '';
  
  // Add each endpoint to the list
  endpoints.forEach(endpoint => {
    const row = document.createElement('tr');
    
    // Path column
    const pathCell = document.createElement('td');
    pathCell.textContent = endpoint.path;
    row.appendChild(pathCell);
    
    // Method column
    const methodCell = document.createElement('td');
    const methodSpan = document.createElement('span');
    methodSpan.className = getMethodClass(endpoint.method);
    methodSpan.textContent = endpoint.method.toUpperCase();
    methodCell.appendChild(methodSpan);
    row.appendChild(methodCell);
    
    // Description column
    const descCell = document.createElement('td');
    descCell.textContent = endpoint.description || '-';
    row.appendChild(descCell);
    
    // Status column with test button
    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge bg-secondary me-2';
    statusBadge.textContent = 'Not Tested';
    statusCell.appendChild(statusBadge);
    
    const testButton = document.createElement('button');
    testButton.className = 'btn btn-sm btn-outline-primary';
    testButton.textContent = 'Test';
    testButton.dataset.path = endpoint.path;
    testButton.dataset.method = endpoint.method;
    testButton.addEventListener('click', testEndpoint);
    statusCell.appendChild(testButton);
    
    row.appendChild(statusCell);
    
    endpointsList.appendChild(row);
  });
  
  // Show the endpoints container
  endpointsContainer.style.display = 'block';
  
  console.log(`Displayed ${endpoints.length} endpoints in the UI`);
}

/**
 * Get the CSS class for the HTTP method
 * @param {string} method - HTTP method
 * @returns {string} - CSS class
 */
function getMethodClass(method) {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-success';
    case 'POST':
      return 'text-primary';
    case 'PUT':
      return 'text-info';
    case 'DELETE':
      return 'text-danger';
    case 'PATCH':
      return 'text-warning';
    default:
      return '';
  }
}

/**
 * Test a specific endpoint from the OpenAPI specification
 * @param {Event} event - Click event
 */
async function testEndpoint(event) {
  const button = event.target;
  const path = button.dataset.path;
  const method = button.dataset.method;
  
  if (!path || !method) {
    console.error('Missing path or method for endpoint test');
    return;
  }
  
  // Get the status badge (previous sibling of the button)
  const statusBadge = button.previousElementSibling;
  
  try {
    // Disable the button during testing
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    
    // Update status badge
    statusBadge.className = 'badge bg-warning me-2';
    statusBadge.textContent = 'Testing...';
    
    // Make the request to test the endpoint
    const response = await fetch('/api/rapid7/test-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: path,
        method: method
      })
    });
    
    const result = await response.json();
    
    // Update status badge based on result
    if (result.success) {
      statusBadge.className = 'badge bg-success me-2';
      statusBadge.textContent = 'Success';
    } else {
      statusBadge.className = 'badge bg-danger me-2';
      statusBadge.textContent = 'Failed';
    }
    
    console.log(`Endpoint test result for ${method} ${path}:`, result);
  } catch (error) {
    console.error(`Error testing endpoint ${method} ${path}:`, error);
    statusBadge.className = 'badge bg-danger me-2';
    statusBadge.textContent = 'Error';
  } finally {
    // Re-enable the button
    button.disabled = false;
    button.textContent = 'Test';
  }
}

/**
 * Initialize Rapid7 API settings
 */
function initRapid7Settings() {
  // Get all required elements with null checks
  const apiUrlInput = document.getElementById('rapid7-api-url');
  const apiKeyInput = document.getElementById('rapid7-api-key');
  const testButton = document.getElementById('test-rapid7-connection');
  const statusIndicator = document.getElementById('rapid7-status-indicator');
  const statusText = document.getElementById('rapid7-status-text');
  const testResult = document.getElementById('test-rapid7-result');
  const rapid7Form = document.getElementById('rapid7-settings-form');
  const specFileInput = document.getElementById('rapid7-openapi-spec');
  const parseButton = document.getElementById('parse-rapid7-spec');
  const parseResult = document.getElementById('rapid7-spec-status');
  
  // Log for debugging
  console.log('Initializing Rapid7 settings with elements:', {
    apiUrlInput: !!apiUrlInput,
    apiKeyInput: !!apiKeyInput,
    testButton: !!testButton,
    statusIndicator: !!statusIndicator,
    statusText: !!statusText,
    testResult: !!testResult,
    rapid7Form: !!rapid7Form,
    specFileInput: !!specFileInput,
    parseButton: !!parseButton,
    parseResult: !!parseResult
  });
  
  // Exit if required elements are missing
  if (!apiUrlInput || !apiKeyInput || !testButton || !statusIndicator || !statusText || !testResult) {
    console.warn('Required elements for Rapid7 settings not found');
    return;
  }
  
  // Check if form exists
  if (!rapid7Form) {
    console.warn('Rapid7 settings form not found');
    return;
  }
  
  // Client-side validation for the form before submission
  if (rapid7Form) {
    rapid7Form.addEventListener('submit', function(event) {
      event.preventDefault(); // Prevent default form submission
      
      const apiUrl = apiUrlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();
      
      console.log('Validating Rapid7 settings before submission - API URL:', apiUrl);
      console.log('Validating Rapid7 settings before submission - API Key length:', apiKey ? apiKey.length : 0);
      
      // Basic validation
      if (!apiUrl) {
        alert('Please enter a valid API URL');
        apiUrlInput.focus();
        return false;
      }
      
      if (!apiKey) {
        alert('Please enter a valid API Key');
        apiKeyInput.focus();
        return false;
      }
      
      // Format the URL properly before submission
      let formattedUrl = apiUrl;
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl; // Update the input field
        apiUrlInput.value = formattedUrl;
      }
      
      // Add hidden fields for other settings to prevent them from being cleared
      // This ensures we're only updating the Rapid7 settings
      const addHiddenField = (name, value) => {
        let field = rapid7Form.querySelector(`input[name="${name}"]`);
        if (!field && value) {
          field = document.createElement('input');
          field.type = 'hidden';
          field.name = name;
          rapid7Form.appendChild(field);
        }
        if (field && value) {
          field.value = value;
        }
      };
      
      // Preserve other settings
      const currentLlmProvider = document.querySelector('input[name="llmProvider"]:checked')?.value || 'openai';
      addHiddenField('llmProvider', currentLlmProvider);
      
      const openaiModelSelect = document.getElementById('openai-model');
      if (openaiModelSelect) {
        addHiddenField('openaiModel', openaiModelSelect.value || 'gpt-3.5-turbo');
      }
      
      const ollamaModelSelect = document.getElementById('ollama-model');
      if (ollamaModelSelect) {
        addHiddenField('ollamaModel', ollamaModelSelect.value || 'llama3.3');
      }
      
      // Submit the form using AJAX
      console.log('Form validation passed, submitting via AJAX...');
      
      // Show loading state
      const submitButton = rapid7Form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
      
      // Create form data from the form
      const formData = new FormData(rapid7Form);
      
      // Send the form data via fetch API
      fetch('/settings', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.message || errorData.error || `HTTP error! Status: ${response.status}`);
          }).catch(e => {
            throw new Error(`HTTP error! Status: ${response.status}`);
          });
        }
        return response.json().catch(() => {
          return { success: true, message: 'Settings saved successfully' };
        });
      })
      .then(data => {
        console.log('Settings saved successfully:', data);
        
        // Show success message
        alert(data.message || 'Rapid7 settings saved successfully!');
        
        // Update the UI to reflect success
        statusIndicator.className = 'status-indicator pending';
        statusText.className = 'ms-2 text-warning';
        statusText.textContent = 'Pending Connection Test';
        
        // Test the connection automatically after a short delay
        setTimeout(() => {
          testButton.click();
        }, 500);
      })
      .catch(error => {
        console.error('Error saving settings:', error);
        alert(`Error saving settings: ${error.message}`);
      })
      .finally(() => {
        // Restore button state
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      });
    });
  }
  
  // Handle form submission with AJAX
  if (rapid7Form) {
    rapid7Form.addEventListener('submit', function(event) {
      event.preventDefault(); // Prevent default form submission
      
      const apiUrl = apiUrlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();
      
      if (!apiUrl) {
        alert('Please enter a valid API URL');
        apiUrlInput.focus();
        return false;
      }
      
      if (!apiKey) {
        alert('Please enter a valid API Key');
        apiKeyInput.focus();
        return false;
      }
      
      // Format the URL properly before submission
      let formattedUrl = apiUrl;
      
      // Add https:// if missing
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
        apiUrlInput.value = formattedUrl; // Update the input field
      }
      
      // Trim trailing slashes
      if (formattedUrl.endsWith('/')) {
        formattedUrl = formattedUrl.slice(0, -1);
        apiUrlInput.value = formattedUrl; // Update the input field
      }
      
      console.log('Submitting Rapid7 settings form with URL:', formattedUrl);
      
      // Create form data
      const formData = new FormData(rapid7Form);
      
      // Submit form via AJAX
      fetch('/settings', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        console.log('Settings saved response:', data);
        if (data.success) {
          // Show success message
          alert('Rapid7 settings saved successfully!');
          
          // If connection was tested as part of the save, update the status
          if (data.connectionValid) {
            statusIndicator.className = 'status-indicator online';
            statusText.className = 'ms-2 text-success';
            statusText.textContent = 'Connected';
          }
          
          // Test the connection automatically
          testButton.click();
        } else {
          alert('Error saving settings: ' + (data.message || 'Unknown error'));
        }
      })
      .catch(error => {
        console.error('Error saving Rapid7 settings:', error);
        alert('Error saving settings: ' + error.message);
      });
      
      return false;
    });
  }
  
  // Test Rapid7 connection
  testButton.addEventListener('click', async function() {
    const apiUrl = apiUrlInput.value.trim();
    // Always get the value directly from the input element, regardless of type
    const apiKey = apiKeyInput.value.trim();
    
    console.log('Testing Rapid7 connection - API URL:', apiUrl);
    console.log('Testing Rapid7 connection - API Key length:', apiKey ? apiKey.length : 0);
    
    if (!apiUrl) {
      alert('Please enter a valid API URL');
      apiUrlInput.focus();
      return;
    }
    
    if (!apiKey) {
      alert('Please enter a valid API Key');
      apiKeyInput.focus();
      return;
    }
    
    try {
      testButton.disabled = true;
      testResult.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Testing...';
      
      // Format the URL properly
      let formattedUrl = apiUrl;
      
      // Add https:// if missing
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
        apiUrlInput.value = formattedUrl; // Update the input field
      }
      
      // Trim trailing slashes and ensure proper format
      formattedUrl = formattedUrl.trim().replace(/\/+$/, '');
      
      // Try to parse the URL to validate format
      try {
        new URL(formattedUrl);
      } catch (urlError) {
        throw new Error('Invalid URL format: ' + urlError.message);
      }
      
      // Call the test connection endpoint
      console.log('Calling /api/rapid7-test/connection with API URL:', formattedUrl);
      
      // Update UI to show testing in progress
      statusIndicator.className = 'status-indicator pending';
      statusText.className = 'ms-2 text-warning';
      statusText.textContent = 'Testing...';
      testResult.className = 'ms-2 text-warning';
      
      const response = await fetch('/api/rapid7-test/connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl: formattedUrl,
          apiKey: apiKey
        })
      });
      
      console.log('Connection test response status:', response.status);
      
      // Always try to parse the response body for better error messages
      let responseBody;
      try {
        responseBody = await response.json();
        console.log('Connection test response body:', responseBody);
      } catch (parseError) {
        console.error('Error parsing connection test response:', parseError);
        // Continue with undefined responseBody
      }
      
      // Handle the response
      if (response.ok && responseBody && (responseBody.success || responseBody.status === 'UP')) {
        // Success case
        testResult.className = 'ms-2 text-success';
        testResult.textContent = 'Connection successful!';
        
        // Update status indicator
        statusIndicator.className = 'status-indicator online';
        statusText.className = 'ms-2 text-success';
        statusText.textContent = 'Connected';
      } else {
        // Failure case - provide a clear error message
        const errorMessage = responseBody?.message || responseBody?.error || 'Connection failed. Check your API URL and key.';
        console.error('Connection test failed:', errorMessage);
        
        testResult.className = 'ms-2 text-danger';
        testResult.textContent = errorMessage;
        
        // Update status indicator
        statusIndicator.className = 'status-indicator offline';
        statusText.className = 'ms-2 text-danger';
        statusText.textContent = 'Disconnected';
      }
    } catch (error) {
      console.error('Error in test connection handler:', error);
      
      testResult.className = 'ms-2 text-danger';
      testResult.textContent = error.message;
      
      // Update status indicator
      statusIndicator.className = 'status-indicator offline';
      statusText.className = 'ms-2 text-danger';
      statusText.textContent = 'Error';
    } finally {
      testButton.disabled = false;
    }
  });
  
  // Add event listener for parsing OpenAPI spec file
  if (parseButton && specFileInput) {
    parseButton.addEventListener('click', async function() {
      // Check if a file is selected
      if (!specFileInput.files || specFileInput.files.length === 0) {
        alert('Please select an OpenAPI JSON file');
        return;
      }
      
      const file = specFileInput.files[0];
      
      // Check if the file is a JSON file
      if (!file.name.toLowerCase().endsWith('.json')) {
        alert('Please select a JSON file');
        return;
      }
      
      try {
        parseButton.disabled = true;
        if (parseResult) {
          parseResult.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Parsing...';
        }
        
        // Create form data for file upload
        const formData = new FormData();
        formData.append('openapi_file', file);
        
        // Send the file to the server for parsing
        const response = await fetch('/api/rapid7/parse-openapi', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          if (parseResult) {
            parseResult.className = 'ms-2 text-success';
            parseResult.textContent = 'Successfully parsed OpenAPI spec';
          }
          
          // If the API URL was updated, update the input field
          if (result.data && result.data.baseUrl) {
            try {
              // Validate the URL format
              const urlObj = new URL(result.data.baseUrl);
              
              // Update the input field
              apiUrlInput.value = result.data.baseUrl;
              console.log('Updated API URL from OpenAPI spec:', result.data.baseUrl);
            } catch (updateError) {
              console.error('Error updating Rapid7 API URL:', updateError);
            }
          }
          
          // Display summary of the parsed spec
          alert(`Successfully parsed OpenAPI spec: ${result.data.title} (${result.data.version})\n` +
                `Found ${result.data.endpoints.length} endpoints\n` +
                `Base URL: ${result.data.baseUrl}`);
          
          // Display discovered endpoints
          displayEndpoints(result.data.endpoints);
        } else {
          if (parseResult) {
            parseResult.className = 'ms-2 text-danger';
            parseResult.textContent = 'Failed to parse file: ' + result.message;
          }
          alert('Failed to parse OpenAPI spec: ' + result.message);
        }
      } catch (error) {
        console.error('Error parsing OpenAPI spec:', error);
        if (parseResult) {
          parseResult.className = 'ms-2 text-danger';
          parseResult.textContent = 'Error: ' + error.message;
        }
        alert('Error parsing OpenAPI spec: ' + error.message);
      } finally {
        parseButton.disabled = false;
      }
    });
  }
  
  // Add functionality to parse OpenAPI from a specific path
  const parseFromPathButton = document.getElementById('parse-rapid7-path');
  const pathInput = document.getElementById('rapid7-openapi-path');
  
  if (parseFromPathButton && pathInput) {
    parseFromPathButton.addEventListener('click', async function() {
      const filePath = pathInput.value.trim();
      
      if (!filePath) {
        alert('Please enter a file path');
        return;
      }
      
      try {
        parseFromPathButton.disabled = true;
        if (parseResult) {
          parseResult.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Parsing...';
        }
        
        // Send the path to the server for parsing
        const response = await fetch('/api/rapid7/parse-openapi-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: filePath
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          if (parseResult) {
            parseResult.className = 'ms-2 text-success';
            parseResult.textContent = 'Successfully parsed OpenAPI spec from path';
          }
          
          // If the API URL was updated, update the input field
          if (result.data && result.data.baseUrl) {
            try {
              // Validate the URL format
              const urlObj = new URL(result.data.baseUrl);
              
              // Update the input field
              apiUrlInput.value = result.data.baseUrl;
              console.log('Updated API URL from OpenAPI spec:', result.data.baseUrl);
            } catch (updateError) {
              console.error('Error updating Rapid7 API URL:', updateError);
            }
          }
          
          // Display summary of the parsed spec
          alert(`Successfully parsed OpenAPI spec: ${result.data.title} (${result.data.version})\n` +
                `Found ${result.data.endpoints.length} endpoints\n` +
                `Base URL: ${result.data.baseUrl}`);
          
          // Display discovered endpoints
          displayEndpoints(result.data.endpoints);
        } else {
          if (parseResult) {
            parseResult.className = 'ms-2 text-danger';
            parseResult.textContent = 'Failed to parse file: ' + result.message;
          }
          alert('Failed to parse OpenAPI spec from path: ' + result.message);
        }
      } catch (error) {
        console.error('Error parsing OpenAPI spec from path:', error);
        if (parseResult) {
          parseResult.className = 'ms-2 text-danger';
          parseResult.textContent = 'Error: ' + error.message;
        }
        alert('Error parsing OpenAPI spec from path: ' + error.message);
      } finally {
        parseFromPathButton.disabled = false;
      }
    });
  }
  
  // Toggle password visibility for API key
  const toggleButton = document.getElementById('toggle-rapid7-api-key');
  if (toggleButton && apiKeyInput) {
    toggleButton.addEventListener('click', function() {
      const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
      apiKeyInput.setAttribute('type', type);
      toggleButton.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
  }
  
  // Sync vulnerabilities button
  const syncButton = document.getElementById('sync-vulnerabilities');
  if (syncButton) {
    syncButton.addEventListener('click', async function() {
      try {
        syncButton.disabled = true;
        syncButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Syncing...';
        
        const response = await fetch('/api/rapid7/sync', {
          method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
          alert(`Successfully synced ${result.data.count} vulnerabilities`);
        } else {
          alert('Error syncing vulnerabilities: ' + result.message);
        }
      } catch (error) {
        console.error('Error syncing vulnerabilities:', error);
        alert('Error syncing vulnerabilities: ' + error.message);
      } finally {
        syncButton.disabled = false;
        syncButton.textContent = 'Sync Vulnerabilities';
      }
    });
  }
}

// Other initialization functions would go here...
// For brevity, I'm omitting them since they're not directly related to the issue

/**
 * Initialize Bootstrap tabs
 */
function initTabs() {
  const tabLinks = document.querySelectorAll('.nav-link');
  tabLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      
      // Remove active class from all tabs
      tabLinks.forEach(tab => tab.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Hide all tab content
      const tabContents = document.querySelectorAll('.tab-pane');
      tabContents.forEach(content => content.classList.remove('show', 'active'));
      
      // Show the selected tab content
      const targetId = this.getAttribute('href').substring(1);
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('show', 'active');
      }
    });
  });
}

/**
 * Initialize password toggle buttons
 */
function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll('[id^="toggle-"]');
  toggleButtons.forEach(button => {
    const inputId = button.id.replace('toggle-', '');
    const input = document.getElementById(inputId);
    
    if (input) {
      button.addEventListener('click', function() {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        button.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
      });
    }
  });
}

// Placeholder functions for other settings initializations
function initOpenAISettings() {
  // Implementation would go here
  console.log('OpenAI settings initialized');
}

function initOllamaSettings() {
  // Implementation would go here
  console.log('Ollama settings initialized');
}

function initLLMProviderSettings() {
  const form = document.getElementById('llm-settings-form');
  const openaiRadio = document.getElementById('providerOpenAI');
  const ollamaRadio = document.getElementById('providerOllama');

  // Only proceed with element manipulation if the elements exist
  // This ensures the function works even on pages where these elements don't exist
  if (openaiRadio && ollamaRadio) {
    // Fetch current provider on load and set radio
    fetch('/api/settings/provider')
      .then(res => res.json())
      .then(data => {
        if (data.provider === 'openai') {
          openaiRadio.checked = true;
          ollamaRadio.checked = false;
        } else {
          openaiRadio.checked = false;
          ollamaRadio.checked = true;
        }
      })
      .catch(err => {
        console.debug('Provider fetch failed, defaulting to openai', err);
      });
  } else {
    console.debug('LLM provider radio elements not found on this page');
  }

  // No JS form submission: let browser submit normally
}

  const form = document.getElementById('llm-settings-form');
  // No JS form submission: let browser submit normally

}

function initPostgresqlSettings() {
  // Implementation would go here
  console.log('PostgreSQL settings initialized');
}

function initRedisSettings() {
  // Implementation would go here
  console.log('Redis settings initialized');
}
