/**
 * Reusable Threat Model Modal
 * 
 * This script provides a reusable popup modal for threat model creation 
 * and a results display modal that mirrors the threat model details page.
 * 
 * Usage:
 * 1. Include this script in your page
 * 2. Call showThreatModelModal(componentName, projectId) to show the creation modal
 * 3. The results will automatically be displayed in a separate modal
 */

(function() {
  console.log('Loading Reusable Threat Model Modal');
  
  // Add the modal HTML to the page if it doesn't exist
  function ensureModalsExist() {
    // Check if threat model creation modal exists
    if (!document.getElementById('threatModelCreationModal')) {
      const creationModal = document.createElement('div');
      creationModal.innerHTML = `
        <div class="modal fade" id="threatModelCreationModal" tabindex="-1" aria-labelledby="threatModelCreationModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="threatModelCreationModalLabel">Create a New Threat Model</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <form id="threatModelCreationForm">
                  <div class="mb-3">
                    <label for="tm_subject" class="form-label">System to Analyze</label>
                    <input type="text" class="form-control" id="tm_subject" name="subject" placeholder="e.g., Web Application, Mobile App, API Service">
                  </div>
                  
                  <div class="mb-3">
                    <label for="tm_aiModel" class="form-label">AI Model to Use</label>
                    <select class="form-select" id="tm_aiModel" name="model">
                      <!-- This will be populated dynamically -->
                    </select>
                    <div class="form-text" id="tm_modelProvider">
                      <!-- Provider info will be set dynamically -->
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <label for="tm_promptTitle" class="form-label">Prompt Template</label>
                    <div class="input-group">
                      <input type="hidden" id="tm_promptId" name="selectedPromptId">
                      <input type="text" class="form-control" id="tm_promptTitle" name="promptTitle" placeholder="Select a prompt template" readonly>
                      <button class="btn btn-outline-secondary" type="button" id="tm_selectPromptBtn">
                        <i class="bi bi-list"></i> Select
                      </button>
                    </div>
                  </div>
                  
                  <!-- Hidden input for project ID -->
                  <input type="hidden" id="tm_projectId" name="projectId">
                </form>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="tm_generateBtn">
                  <i class="bi bi-lightning me-1"></i>Generate Threat Model
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(creationModal);
      
      // Set up event listeners
      document.getElementById('tm_selectPromptBtn').addEventListener('click', showPromptSelectionModal);
      document.getElementById('tm_generateBtn').addEventListener('click', handleThreatModelGeneration);
    }
    
    // Check if threat model results modal exists
    if (!document.getElementById('threatModelResultsModal')) {
      const resultsModal = document.createElement('div');
      resultsModal.innerHTML = `
        <div class="modal fade" id="threatModelResultsModal" tabindex="-1" aria-labelledby="threatModelResultsModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-scrollable">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="threatModelResultsModalLabel">Threat Model Results</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body" id="tm_resultsContent">
                <div class="text-center p-5">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p class="mt-2">Generating your threat model...</p>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-success" id="tm_saveResultsBtn">
                  <i class="bi bi-save me-1"></i>Save Threat Model
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(resultsModal);
      
      // Set up event listeners
      document.getElementById('tm_saveResultsBtn').addEventListener('click', handleSaveThreatModel);
    }
    
    // Check if prompts selection modal exists
    if (!document.getElementById('promptsSelectionModal')) {
      const promptsModal = document.createElement('div');
      promptsModal.innerHTML = `
        <div class="modal fade" id="promptsSelectionModal" tabindex="-1" aria-labelledby="promptsSelectionModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="promptsSelectionModalLabel">Select Prompt Template</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <input type="text" class="form-control" id="tm_promptSearch" placeholder="Search prompts...">
                </div>
                <div class="list-group" id="tm_promptsList">
                  <!-- Prompts will be loaded here -->
                  <div class="text-center p-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                      <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading prompt templates...</span>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(promptsModal);
      
      // Add event listener for prompt search
      document.getElementById('tm_promptSearch').addEventListener('input', filterPrompts);
    }
  }
  
  // Function to populate the AI model dropdown
  function populateAIModels() {
    fetchWithAuth('/api/settings')
      .then(response => response.json())
      .then(settings => {
        const modelSelect = document.getElementById('tm_aiModel');
        modelSelect.innerHTML = ''; // Clear existing options
        
        const providerInfo = document.getElementById('tm_modelProvider');
        
        if (settings.llmProvider === 'ollama') {
          // Populate with Ollama models
          settings.availableOllamaModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            option.selected = (model.name === settings.ollamaModel);
            modelSelect.appendChild(option);
          });
          
          providerInfo.innerHTML = 'Using local Ollama models.';
        } else {
          // Populate with OpenAI models
          const openaiModels = [
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
            { id: 'gpt-4', name: 'GPT-4' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
          ];
          
          openaiModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            option.selected = (model.id === settings.openaiModel);
            modelSelect.appendChild(option);
          });
          
          providerInfo.innerHTML = 'Using OpenAI API.';
        }
      })
      .catch(error => {
        console.error('Error fetching AI settings:', error);
        document.getElementById('tm_modelProvider').innerHTML = 
          '<span class="text-danger">Error loading AI models. Please try again.</span>';
      });
  }
  
  // Function to load available prompts
  function loadPrompts() {
    const promptsList = document.getElementById('tm_promptsList');
    
    fetchWithAuth('/api/prompts')
      .then(response => response.json())
      .then(prompts => {
        if (prompts.length === 0) {
          promptsList.innerHTML = '<div class="text-center p-3">No prompt templates found.</div>';
          return;
        }
        
        promptsList.innerHTML = '';
        prompts.forEach(prompt => {
          const promptItem = document.createElement('a');
          promptItem.href = '#';
          promptItem.className = 'list-group-item list-group-item-action';
          promptItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
              <h5 class="mb-1">${prompt.title}</h5>
              <small>${prompt.category || 'General'}</small>
            </div>
            <p class="mb-1">${prompt.description || 'No description provided.'}</p>
          `;
          
          promptItem.addEventListener('click', function(e) {
            e.preventDefault();
            selectPrompt(prompt);
          });
          
          promptsList.appendChild(promptItem);
        });
      })
      .catch(error => {
        console.error('Error loading prompts:', error);
        promptsList.innerHTML = '<div class="text-center p-3 text-danger">Error loading prompt templates. Please try again.</div>';
      });
  }
  
  // Function to filter prompts based on search input
  function filterPrompts() {
    const searchText = document.getElementById('tm_promptSearch').value.toLowerCase();
    const promptItems = document.querySelectorAll('#tm_promptsList .list-group-item');
    
    promptItems.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(searchText) ? '' : 'none';
    });
  }
  
  // Function to select a prompt template
  function selectPrompt(prompt) {
    document.getElementById('tm_promptId').value = prompt.id;
    document.getElementById('tm_promptTitle').value = prompt.title;
    
    // Close the prompts modal
    const promptsModal = bootstrap.Modal.getInstance(document.getElementById('promptsSelectionModal'));
    if (promptsModal) {
      promptsModal.hide();
    }
  }
  
  // Function to show the prompt selection modal
  function showPromptSelectionModal() {
    loadPrompts();
    const promptsModal = new bootstrap.Modal(document.getElementById('promptsSelectionModal'));
    promptsModal.show();
  }
  
  // Function to handle threat model generation
  function handleThreatModelGeneration() {
    const subject = document.getElementById('tm_subject').value.trim();
    const model = document.getElementById('tm_aiModel').value;
    const promptId = document.getElementById('tm_promptId').value;
    const projectId = document.getElementById('tm_projectId').value;
    
    if (!subject) {
      alert('Please enter a system to analyze.');
      return;
    }
    
    if (!promptId) {
      alert('Please select a prompt template.');
      return;
    }
    
    // Show the results modal with loading indicator
    const creationModal = bootstrap.Modal.getInstance(document.getElementById('threatModelCreationModal'));
    if (creationModal) {
      creationModal.hide();
    }
    
    const resultsModal = new bootstrap.Modal(document.getElementById('threatModelResultsModal'));
    resultsModal.show();
    
    // Prepare request data
    const requestData = {
      subject,
      model,
      selectedPromptId: promptId
    };
    
    if (projectId) {
      requestData.projectId = projectId;
    }
    
    // Send the request to generate a threat model
    fetchWithAuth('/api/generate-threat-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data.requestId) {
          // Poll for results if we have a request ID
          pollForResults(data.requestId);
        } else {
          displayThreatModelResults(data);
        }
      })
      .catch(error => {
        console.error('Error generating threat model:', error);
        document.getElementById('tm_resultsContent').innerHTML = `
          <div class="alert alert-danger">
            <h4 class="alert-heading">Error!</h4>
            <p>Failed to generate threat model: ${error.message}</p>
            <hr>
            <p class="mb-0">Please try again or contact support if the issue persists.</p>
          </div>
          <button class="btn btn-primary" onclick="window.showThreatModelModal()">Try Again</button>
        `;
      });
  }
  
  // Function to poll for results
  function pollForResults(requestId) {
    const checkInterval = setInterval(() => {
      fetchWithAuth(`/api/request-status/${requestId}`)
        .then(response => response.json())
        .then(data => {
          if (data.status === 'completed') {
            clearInterval(checkInterval);
            fetchWithAuth(`/api/results/${requestId}`)
              .then(response => response.json())
              .then(results => {
                displayThreatModelResults(results);
              })
              .catch(error => {
                console.error('Error fetching results:', error);
                document.getElementById('tm_resultsContent').innerHTML = `
                  <div class="alert alert-danger">
                    <h4 class="alert-heading">Error!</h4>
                    <p>Failed to fetch threat model results: ${error.message}</p>
                    <hr>
                    <p class="mb-0">Please try again or contact support if the issue persists.</p>
                  </div>
                `;
              });
          } else if (data.status === 'failed') {
            clearInterval(checkInterval);
            document.getElementById('tm_resultsContent').innerHTML = `
              <div class="alert alert-danger">
                <h4 class="alert-heading">Generation Failed!</h4>
                <p>${data.error || 'An unknown error occurred during threat model generation.'}</p>
                <hr>
                <p class="mb-0">Please try again with different parameters.</p>
              </div>
              <button class="btn btn-primary" onclick="window.showThreatModelModal()">Try Again</button>
            `;
          } else {
            // Update progress information if available
            if (data.progress) {
              document.getElementById('tm_resultsContent').innerHTML = `
                <div class="text-center p-5">
                  <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                  </div>
                  <p class="mt-2">${data.progress}</p>
                </div>
              `;
            }
          }
        })
        .catch(error => {
          console.error('Error checking request status:', error);
        });
    }, 2000);
  }
  
  // Function to display threat model results
  function displayThreatModelResults(results) {
    // Check if we're dealing with an immediate result or an API response
    const threatModel = results.threatModel || results;
    
    // Format the content similar to the results page
    let content = `
      <div class="container-fluid p-0">
        <div class="card mb-4">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h4>${threatModel.title || 'Threat Model Analysis'}</h4>
            <span class="badge bg-primary">${threatModel.system || threatModel.subject || 'System Analysis'}</span>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-12">
                <h5 class="mb-3">System Description</h5>
                <div class="p-3 bg-light rounded mb-4">
                  ${formatContent(threatModel.systemDescription || 'No system description provided.')}
                </div>
              </div>
            </div>
    `;
    
    // Add assets section if available
    if (threatModel.assets && threatModel.assets.length > 0) {
      content += `
        <div class="row mt-4">
          <div class="col-md-12">
            <h5 class="mb-3">Assets</h5>
            <div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Description</th>
                    <th>Sensitivity</th>
                  </tr>
                </thead>
                <tbody>
      `;
      
      threatModel.assets.forEach(asset => {
        content += `
          <tr>
            <td><strong>${asset.name || 'Unnamed Asset'}</strong></td>
            <td>${asset.description || 'No description'}</td>
            <td>
              <span class="badge bg-${getSensitivityClass(asset.sensitivity || 'Medium')}">
                ${asset.sensitivity || 'Medium'}
              </span>
            </td>
          </tr>
        `;
      });
      
      content += `
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add threats section
    if (threatModel.threats && threatModel.threats.length > 0) {
      content += `
        <div class="row mt-4">
          <div class="col-md-12">
            <h5 class="mb-3">Identified Threats</h5>
            <div class="accordion" id="threatAccordion">
      `;
      
      threatModel.threats.forEach((threat, index) => {
        content += `
          <div class="accordion-item">
            <h2 class="accordion-header" id="heading${index}">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="false" aria-controls="collapse${index}">
                <div class="d-flex w-100 justify-content-between align-items-center">
                  <span>${threat.title || `Threat #${index + 1}`}</span>
                  <span class="badge bg-${getSeverityClass(threat.severity || 'Medium')} ms-2">
                    ${threat.severity || 'Medium'}
                  </span>
                </div>
              </button>
            </h2>
            <div id="collapse${index}" class="accordion-collapse collapse" aria-labelledby="heading${index}" data-bs-parent="#threatAccordion">
              <div class="accordion-body">
                <p><strong>Description:</strong> ${threat.description || 'No description provided'}</p>
                
                ${threat.impact ? `<p><strong>Impact:</strong> ${threat.impact}</p>` : ''}
                ${threat.likelihood ? `<p><strong>Likelihood:</strong> ${threat.likelihood}</p>` : ''}
                
                ${threat.mitigations && threat.mitigations.length ? `
                  <h6 class="mt-3">Mitigations</h6>
                  <ul class="list-group">
                    ${threat.mitigations.map(m => `
                      <li class="list-group-item">
                        <div class="d-flex w-100 justify-content-between">
                          <h6 class="mb-1">${m.title || 'Mitigation'}</h6>
                          ${m.status ? `<span class="badge bg-${getMitigationStatusClass(m.status)}">${m.status}</span>` : ''}
                        </div>
                        <p class="mb-1">${m.description || 'No description provided'}</p>
                      </li>
                    `).join('')}
                  </ul>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      });
      
      content += `
            </div>
          </div>
        </div>
      `;
    }
    
    // Add recommendations section if available
    if (threatModel.recommendations && threatModel.recommendations.length > 0) {
      content += `
        <div class="row mt-4">
          <div class="col-md-12">
            <h5 class="mb-3">Recommendations</h5>
            <ul class="list-group">
      `;
      
      threatModel.recommendations.forEach(rec => {
        content += `
          <li class="list-group-item">
            <div class="d-flex w-100 justify-content-between">
              <h6 class="mb-1">${rec.title || 'Recommendation'}</h6>
              ${rec.priority ? `<span class="badge bg-${getPriorityClass(rec.priority)}">${rec.priority}</span>` : ''}
            </div>
            <p class="mb-1">${rec.description || 'No description provided'}</p>
          </li>
        `;
      });
      
      content += `
            </ul>
          </div>
        </div>
      `;
    }
    
    // Close the container
    content += `
        </div>
      </div>
    `;
    
    // Set the content to the results modal
    document.getElementById('tm_resultsContent').innerHTML = content;
    
    // Store the results for saving
    window.currentThreatModelResults = threatModel;
  }
  
  // Function to handle saving the threat model
  function handleSaveThreatModel() {
    const threatModel = window.currentThreatModelResults;
    if (!threatModel) {
      alert('No threat model results available to save.');
      return;
    }
    
    // Prepare the data for saving
    const saveData = {
      title: threatModel.title || `Threat Model for ${threatModel.system || threatModel.subject}`,
      system: threatModel.system || threatModel.subject,
      systemDescription: threatModel.systemDescription,
      assets: threatModel.assets,
      threats: threatModel.threats,
      recommendations: threatModel.recommendations
    };
    
    // Add project ID if available
    const projectId = document.getElementById('tm_projectId').value;
    if (projectId) {
      saveData.projectId = projectId;
    }
    
    // Send request to save the threat model
    // Log the payload before sending
    console.log('[frontend][POST /api/threat-models] Payload:', JSON.stringify(saveData));
    fetchWithAuth('/api/threat-models', {
      // Logging: see payload above
    
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saveData)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Show success message
        alert('Threat model saved successfully!');
        
        // Close the results modal
        const resultsModal = bootstrap.Modal.getInstance(document.getElementById('threatModelResultsModal'));
        if (resultsModal) {
          resultsModal.hide();
        }
        
        // Redirect to the threat model if needed
        if (data.id) {
          if (confirm('Would you like to view the saved threat model?')) {
            window.location.href = `/models/${data.id}`;
          } else if (projectId) {
            // If from a project, reload the project page
            window.location.reload();
          }
        }
      })
      .catch(error => {
        // This is the main error log for user display
        // This is the main error log for user display
        console.error('Error saving threat model:', error);
        alert('Failed to save threat model: ' + error.message);
      });
  }
  
  // Helper function to format content
  function formatContent(content) {
    if (!content) return '';
    
    // Convert newlines to <br> tags
    return content.replace(/\n/g, '<br>');
  }
  
  // Helper functions for badge colors
  function getSensitivityClass(sensitivity) {
    switch(sensitivity.toLowerCase()) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'secondary';
    }
  }
  
  function getSeverityClass(severity) {
    switch(severity.toLowerCase()) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'secondary';
    }
  }
  
  function getMitigationStatusClass(status) {
    switch(status.toLowerCase()) {
      case 'implemented': return 'success';
      case 'planned': return 'primary';
      case 'in progress': return 'warning';
      case 'not implemented': return 'danger';
      default: return 'secondary';
    }
  }
  
  function getPriorityClass(priority) {
    switch(priority.toLowerCase()) {
      case 'critical': case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'secondary';
    }
  }
  
  // Helper function for authenticated fetch
  function fetchWithAuth(url, options = {}) {
    // Ensure credentials are included
    const fetchOptions = {
      ...options,
      credentials: 'include'
    };
    
    return fetch(url, fetchOptions);
  }
  
  // Function to show the threat model creation modal
  window.showThreatModelModal = function(componentName, projectId) {
    ensureModalsExist();
    populateAIModels();
    
    // Set the subject and project ID if provided
    if (componentName) {
      document.getElementById('tm_subject').value = componentName;
    }
    
    if (projectId) {
      document.getElementById('tm_projectId').value = projectId;
    } else {
      document.getElementById('tm_projectId').value = '';
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('threatModelCreationModal'));
    modal.show();
  };
  
  // Initialize event listeners when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    ensureModalsExist();
  });
  
  // If document is already loaded, run now
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ensureModalsExist();
  }
})();
