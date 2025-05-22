/**
 * New Project Modal Fix
 * 
 * This script specifically fixes the New Project modal form by:
 * 1. Ensuring authentication credentials are included
 * 2. Improving error handling
 * 3. Adding better debugging
 */
(function() {
  console.log('New Project Modal Fix loaded');
  
  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    initializeNewProjectForm();
  });
  
  // If the document is already loaded, initialize now
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeNewProjectForm();
  }
  
  function initializeNewProjectForm() {
    console.log('Initializing New Project form fix');
    
    // Find the save button
    const saveNewProjectBtn = document.getElementById('saveNewProject');
    if (!saveNewProjectBtn) {
      console.error('Could not find saveNewProject button');
      return;
    }
    
    // Remove any existing event listeners by cloning and replacing
    const newSaveBtn = saveNewProjectBtn.cloneNode(true);
    saveNewProjectBtn.parentNode.replaceChild(newSaveBtn, saveNewProjectBtn);
    
    // Add our improved event listener
    newSaveBtn.addEventListener('click', function(event) {
      event.preventDefault();
      console.log('Save New Project button clicked');
      
      // Validate form
      const name = document.getElementById('projectName').value.trim();
      if (!name) {
        alert('Project name is required');
        console.log('Validation failed: Project name is required');
        return;
      }
      
      // Collect components data
      const components = [];
      const componentRows = document.querySelectorAll('#componentTable .component-row');
      console.log(`Found ${componentRows.length} component rows`);
      
      componentRows.forEach((row, index) => {
        const nameInput = row.querySelector('.component-name');
        const hostnameInput = row.querySelector('.component-hostname');
        const ipInput = row.querySelector('.component-ip');
        const typeSelect = row.querySelector('.component-type');
        
        // Only add if component name is provided
        if (nameInput && nameInput.value.trim()) {
          components.push({
            name: nameInput.value.trim(),
            hostname: hostnameInput ? hostnameInput.value.trim() : '',
            ip_address: ipInput ? ipInput.value.trim() : '',
            type: typeSelect ? typeSelect.value : ''
          });
          console.log(`Added component ${index+1}: ${nameInput.value.trim()}`);
        }
      });
      
      // Prepare project data
      const projectData = {
        name: name,
        description: document.getElementById('projectDescription').value.trim(),
        business_unit: document.getElementById('businessUnit').value.trim(),
        criticality: document.getElementById('criticality').value,
        data_classification: document.getElementById('dataClassification').value,
        status: document.getElementById('projectStatus').value,
        components: components
      };
      
      // Show status to user
      let statusElement = document.querySelector('#newProjectForm .status-message');
      if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'alert alert-info mt-3 status-message';
        document.querySelector('#newProjectForm').appendChild(statusElement);
      }
      
      statusElement.className = 'alert alert-info mt-3 status-message';
      statusElement.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>Saving project...';
      
      // Add a spinning animation
      if (!document.querySelector('#spin-style')) {
        const style = document.createElement('style');
        style.id = 'spin-style';
        style.textContent = `
          .spin {
            display: inline-block;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Log the data for debugging
      console.log('Project data to be submitted:', projectData);
      
      // Submit via AJAX with explicit error handling
      fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(projectData),
        credentials: 'include' // Include session cookies for authentication
      })
      .then(response => {
        console.log(`Response received: ${response.status} ${response.statusText}`);
        
        // Clone the response so we can both check it and return it
        const clonedResponse = response.clone();
        
        if (!response.ok) {
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
            });
        }
        
        return response.json();
      })
      .then(data => {
        console.log('API response:', data);
        
        if (data.success) {
          // Show success message
          statusElement.className = 'alert alert-success mt-3 status-message';
          statusElement.innerHTML = '<i class="bi bi-check-circle me-2"></i>Project created successfully!';
          
          // Add a direct link to the new project
          if (data.data && data.data.id) {
            statusElement.innerHTML += `
              <div class="mt-2">
                <a href="/projects/${data.data.id}" class="btn btn-sm btn-primary">View Project</a>
                <button type="button" class="btn btn-sm btn-secondary ms-2 reload-btn">Reload Page</button>
              </div>
            `;
            
            // Add reload button handler
            statusElement.querySelector('.reload-btn').addEventListener('click', function() {
              window.location.reload();
            });
          } else {
            // Fallback if no project ID is available
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        } else {
          // Show error message
          statusElement.className = 'alert alert-danger mt-3 status-message';
          statusElement.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>Error: ${data.error || 'Unknown error'}`;
        }
      })
      .catch(error => {
        console.error('Error creating project:', error);
        
        // Show error message
        statusElement.className = 'alert alert-danger mt-3 status-message';
        statusElement.innerHTML = `
          <i class="bi bi-exclamation-triangle me-2"></i>Error: ${error.message}
          <div class="mt-2">
            <button type="button" class="btn btn-sm btn-warning retry-btn">Retry</button>
            <button type="button" class="btn btn-sm btn-info ms-2 check-auth-btn">Check Auth</button>
          </div>
        `;
        
        // Add retry button handler
        statusElement.querySelector('.retry-btn').addEventListener('click', function() {
          newSaveBtn.click();
        });
        
        // Add check auth button handler
        statusElement.querySelector('.check-auth-btn').addEventListener('click', function() {
          statusElement.innerHTML = '<i class="bi bi-arrow-repeat spin me-2"></i>Checking authentication...';
          
          fetch('/api/status', {
            credentials: 'include'
          })
          .then(response => response.json())
          .then(data => {
            statusElement.innerHTML = `<div>Auth check result: ${JSON.stringify(data)}</div>`;
          })
          .catch(err => {
            statusElement.innerHTML = `<div>Auth check error: ${err.message}</div>`;
          });
        });
      });
    });
    
    // Also fix the Add Component Row button
    const addComponentRowBtn = document.getElementById('addComponentRow');
    if (addComponentRowBtn) {
      // Remove any existing event listeners
      const newAddBtn = addComponentRowBtn.cloneNode(true);
      addComponentRowBtn.parentNode.replaceChild(newAddBtn, addComponentRowBtn);
      
      // Add our improved event listener
      newAddBtn.addEventListener('click', function() {
        const componentTable = document.getElementById('componentTable');
        if (componentTable) {
          const tbody = componentTable.querySelector('tbody');
          if (tbody) {
            // Clone the first row
            const firstRow = tbody.querySelector('.component-row');
            if (firstRow) {
              const newRow = firstRow.cloneNode(true);
              
              // Clear input values
              newRow.querySelectorAll('input').forEach(input => {
                input.value = '';
              });
              
              // Reset select values
              newRow.querySelectorAll('select').forEach(select => {
                select.selectedIndex = 0;
              });
              
              // Add the new row
              tbody.appendChild(newRow);
              console.log('Added new component row');
            }
          }
        }
      });
    }
    
    console.log('New Project form fix initialized');
  }
})();
