/**
 * Rapid7 OpenAPI Specification Parser
 * Parses OpenAPI spec files and extracts endpoint information for Rapid7 API integration
 */

class Rapid7SpecParser {
  constructor() {
    this.spec = null;
    this.endpoints = [];
    this.baseUrl = '';
  }

  /**
   * Parse an OpenAPI specification file
   * @param {File} file - The OpenAPI spec file
   * @returns {Promise<Object>} - The parsed endpoints
   */
  async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const content = event.target.result;
          let parsedSpec;
          
          // Parse JSON or YAML based on file extension
          if (file.name.endsWith('.json')) {
            parsedSpec = JSON.parse(content);
          } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
            // Use YAML parser if available, otherwise show error
            if (typeof jsyaml !== 'undefined') {
              parsedSpec = jsyaml.load(content);
            } else {
              reject(new Error('YAML parser not available. Please include js-yaml library or use JSON format.'));
              return;
            }
          } else {
            reject(new Error('Unsupported file format. Please upload a JSON or YAML file.'));
            return;
          }
          
          this.spec = parsedSpec;
          this.extractEndpoints();
          resolve({
            endpoints: this.endpoints,
            baseUrl: this.baseUrl
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * Extract endpoints from the parsed OpenAPI spec
   */
  extractEndpoints() {
    if (!this.spec) {
      throw new Error('No specification loaded');
    }
    
    this.endpoints = [];
    
    // Extract base URL
    if (this.spec.servers && this.spec.servers.length > 0) {
      // Get the base URL from the server
      let baseUrl = this.spec.servers[0].url;
      
      // Validate the URL format using the relaxed pattern that allows both /vm/ and /vm/vX/
      const serverUrlPattern = /^https?:\/\/[\w.-]+\/vm(\/v\d+)?\/?(.*)?$/;
      if (!serverUrlPattern.test(baseUrl)) {
        console.warn('Server URL does not match expected Rapid7 API pattern. Using as-is:', baseUrl);
      } else {
        // Normalize the URL to ensure it ends with a slash
        if (!baseUrl.endsWith('/')) {
          baseUrl += '/';
        }
      }
      
      this.baseUrl = baseUrl;
    }
    
    // Extract paths and methods
    const paths = this.spec.paths || {};
    
    for (const path in paths) {
      const pathItem = paths[path];
      
      for (const method in pathItem) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          const operation = pathItem[method];
          
          this.endpoints.push({
            path: path,
            method: method.toUpperCase(),
            operationId: operation.operationId || '',
            summary: operation.summary || '',
            description: operation.description || '',
            tags: operation.tags || [],
            parameters: operation.parameters || [],
            requestBody: operation.requestBody || null,
            responses: operation.responses || {}
          });
        }
      }
    }
    
    // Sort endpoints by path
    this.endpoints.sort((a, b) => a.path.localeCompare(b.path));
    
    return this.endpoints;
  }

  /**
   * Get vulnerability-related endpoints
   * @returns {Array} - Vulnerability endpoints
   */
  getVulnerabilityEndpoints() {
    return this.endpoints.filter(endpoint => {
      // Check if path contains 'vulnerabilities' or tags include 'vulnerability'
      return endpoint.path.includes('vulnerabilities') || 
             (endpoint.tags && endpoint.tags.some(tag => 
               tag.toLowerCase().includes('vulnerab')
             ));
    });
  }

  /**
   * Get asset-related endpoints
   * @returns {Array} - Asset endpoints
   */
  getAssetEndpoints() {
    return this.endpoints.filter(endpoint => {
      // Check if path contains 'assets' or tags include 'asset'
      return endpoint.path.includes('assets') || 
             (endpoint.tags && endpoint.tags.some(tag => 
               tag.toLowerCase().includes('asset')
             ));
    });
  }

  /**
   * Get scan-related endpoints
   * @returns {Array} - Scan endpoints
   */
  getScanEndpoints() {
    return this.endpoints.filter(endpoint => {
      // Check if path contains 'scans' or tags include 'scan'
      return endpoint.path.includes('scans') || 
             (endpoint.tags && endpoint.tags.some(tag => 
               tag.toLowerCase().includes('scan')
             ));
    });
  }
}

// Initialize parser when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const parser = new Rapid7SpecParser();
  
  // Set up file input and parse button
  const fileInput = document.getElementById('rapid7-openapi-spec');
  const parseButton = document.getElementById('parse-rapid7-spec');
  const statusDiv = document.getElementById('rapid7-spec-status');
  const endpointsContainer = document.getElementById('rapid7-endpoints-container');
  const endpointsList = document.getElementById('rapid7-endpoints-list');
  
  if (parseButton && fileInput) {
    parseButton.addEventListener('click', async function() {
      if (!fileInput.files || fileInput.files.length === 0) {
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="alert alert-warning">Please select a file first</div>';
        }
        return;
      }
      
      const file = fileInput.files[0];
      
      try {
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="alert alert-info">Parsing specification...</div>';
        }
        
        const result = await parser.parseFile(file);
        
        // Update status
        if (statusDiv) {
          statusDiv.innerHTML = `<div class="alert alert-success">
            Successfully parsed specification with ${result.endpoints.length} endpoints
          </div>`;
        }
        
        // Show endpoints
        if (endpointsContainer && endpointsList) {
          endpointsContainer.style.display = 'block';
          
          // Clear existing endpoints
          endpointsList.innerHTML = '';
          
          // Get categorized endpoints
          const vulnEndpoints = parser.getVulnerabilityEndpoints();
          const assetEndpoints = parser.getAssetEndpoints();
          const scanEndpoints = parser.getScanEndpoints();
          
          // Add vulnerability endpoints first
          vulnEndpoints.forEach(endpoint => {
            const row = document.createElement('tr');
            row.className = 'table-primary'; // Highlight vulnerability endpoints
            row.innerHTML = `
              <td><code>${endpoint.path}</code></td>
              <td>${endpoint.method}</td>
              <td>${endpoint.summary || endpoint.description || ''}</td>
              <td>
                <button class="btn btn-sm btn-outline-success test-endpoint" 
                  data-path="${endpoint.path}" 
                  data-method="${endpoint.method}">
                  Test
                </button>
              </td>
            `;
            endpointsList.appendChild(row);
          });
          
          // Add asset endpoints
          assetEndpoints.forEach(endpoint => {
            const row = document.createElement('tr');
            row.className = 'table-info'; // Highlight asset endpoints
            row.innerHTML = `
              <td><code>${endpoint.path}</code></td>
              <td>${endpoint.method}</td>
              <td>${endpoint.summary || endpoint.description || ''}</td>
              <td>
                <button class="btn btn-sm btn-outline-success test-endpoint" 
                  data-path="${endpoint.path}" 
                  data-method="${endpoint.method}">
                  Test
                </button>
              </td>
            `;
            endpointsList.appendChild(row);
          });
          
          // Add scan endpoints
          scanEndpoints.forEach(endpoint => {
            const row = document.createElement('tr');
            row.className = 'table-warning'; // Highlight scan endpoints
            row.innerHTML = `
              <td><code>${endpoint.path}</code></td>
              <td>${endpoint.method}</td>
              <td>${endpoint.summary || endpoint.description || ''}</td>
              <td>
                <button class="btn btn-sm btn-outline-success test-endpoint" 
                  data-path="${endpoint.path}" 
                  data-method="${endpoint.method}">
                  Test
                </button>
              </td>
            `;
            endpointsList.appendChild(row);
          });
          
          // Add remaining endpoints
          const remainingEndpoints = parser.endpoints.filter(endpoint => 
            !vulnEndpoints.includes(endpoint) && 
            !assetEndpoints.includes(endpoint) &&
            !scanEndpoints.includes(endpoint)
          );
          
          remainingEndpoints.forEach(endpoint => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td><code>${endpoint.path}</code></td>
              <td>${endpoint.method}</td>
              <td>${endpoint.summary || endpoint.description || ''}</td>
              <td>
                <button class="btn btn-sm btn-outline-success test-endpoint" 
                  data-path="${endpoint.path}" 
                  data-method="${endpoint.method}">
                  Test
                </button>
              </td>
            `;
            endpointsList.appendChild(row);
          });
          
          // Add event listeners to test buttons
          document.querySelectorAll('.test-endpoint').forEach(button => {
            button.addEventListener('click', async function() {
              const path = this.getAttribute('data-path');
              const method = this.getAttribute('data-method');
              
              // Get API URL and key from form
              const apiUrl = document.getElementById('rapid7-api-url').value;
              const apiKey = document.getElementById('rapid7-api-key').value;
              
              if (!apiUrl || !apiKey) {
                alert('Please enter API URL and API Key first');
                return;
              }
              
              try {
                this.innerHTML = 'Testing...';
                this.disabled = true;
                
                // Test the endpoint
                const response = await fetch('/api/rapid7-test/endpoint', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    apiUrl,
                    apiKey,
                    path,
                    method
                  })
                });
                
                const result = await response.json();
                
                if (result.success) {
                  this.innerHTML = 'Success';
                  this.className = 'btn btn-sm btn-success test-endpoint';
                } else {
                  this.innerHTML = 'Failed';
                  this.className = 'btn btn-sm btn-danger test-endpoint';
                }
                
                // Reset button after 3 seconds
                setTimeout(() => {
                  this.innerHTML = 'Test';
                  this.className = 'btn btn-sm btn-outline-success test-endpoint';
                  this.disabled = false;
                }, 3000);
                
              } catch (error) {
                this.innerHTML = 'Error';
                this.className = 'btn btn-sm btn-danger test-endpoint';
                
                // Reset button after 3 seconds
                setTimeout(() => {
                  this.innerHTML = 'Test';
                  this.className = 'btn btn-sm btn-outline-success test-endpoint';
                  this.disabled = false;
                }, 3000);
              }
            });
          });
          
          // Add save configuration button
          const saveConfigRow = document.createElement('tr');
          saveConfigRow.className = 'table-success';
          saveConfigRow.innerHTML = `
            <td colspan="4" class="text-center">
              <button id="save-rapid7-config" class="btn btn-success">
                Save Configuration with Selected Endpoints
              </button>
            </td>
          `;
          endpointsList.appendChild(saveConfigRow);
          
          // Add event listener to save configuration button
          document.getElementById('save-rapid7-config').addEventListener('click', function() {
            // Get API URL and key from form
            const apiUrl = document.getElementById('rapid7-api-url').value;
            const apiKey = document.getElementById('rapid7-api-key').value;
            
            if (!apiUrl || !apiKey) {
              alert('Please enter API URL and API Key first');
              return;
            }
            
            // Create configuration object
            const config = {
              apiUrl,
              apiKey,
              baseUrl: result.baseUrl,
              endpoints: {
                vulnerabilities: vulnEndpoints,
                assets: assetEndpoints,
                scans: scanEndpoints
              }
            };
            
            // Save configuration
            fetch('/api/rapid7/config', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(config)
            })
            .then(response => response.json())
            .then(result => {
              if (result.success) {
                alert('Configuration saved successfully');
              } else {
                alert('Error saving configuration: ' + result.message);
              }
            })
            .catch(error => {
              alert('Error saving configuration: ' + error.message);
            });
          });
        }
      } catch (error) {
        console.error('Error parsing specification:', error);
        if (statusDiv) {
          statusDiv.innerHTML = `<div class="alert alert-danger">
            Error parsing specification: ${error.message}
          </div>`;
        }
      }
    });
  }
});
