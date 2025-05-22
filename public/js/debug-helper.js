/**
 * Simple debugging tool for the Threat Model Generator
 */
(function() {
  console.log('Debug helper script loaded');
  
  // Create a debug panel
  function createDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'simple-debug-panel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '10px';
    debugPanel.style.right = '10px';
    debugPanel.style.width = '300px';
    debugPanel.style.maxHeight = '400px';
    debugPanel.style.background = '#333';
    debugPanel.style.color = 'white';
    debugPanel.style.padding = '10px';
    debugPanel.style.borderRadius = '5px';
    debugPanel.style.zIndex = '10000';
    debugPanel.style.overflow = 'auto';
    debugPanel.style.display = 'none';
    
    debugPanel.innerHTML = `
      <h4>Debug Panel</h4>
      <div id="debug-log" style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;"></div>
      <div>
        <button id="clear-debug" style="margin-right: 10px;">Clear</button>
        <button id="close-debug">Close</button>
      </div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Debug';
    toggleButton.id = 'debug-toggle';
    toggleButton.style.position = 'fixed';
    toggleButton.style.bottom = '10px';
    toggleButton.style.right = '10px';
    toggleButton.style.zIndex = '10001';
    toggleButton.style.padding = '5px 10px';
    toggleButton.style.background = '#007BFF';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.cursor = 'pointer';
    
    document.body.appendChild(toggleButton);
    
    // Add event listeners
    toggleButton.addEventListener('click', function() {
      const panel = document.getElementById('simple-debug-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
          toggleButton.style.display = 'none';
        }
      }
    });
    
    document.getElementById('close-debug').addEventListener('click', function() {
      const panel = document.getElementById('simple-debug-panel');
      if (panel) {
        panel.style.display = 'none';
        toggleButton.style.display = 'block';
      }
    });
    
    document.getElementById('clear-debug').addEventListener('click', function() {
      const log = document.getElementById('debug-log');
      if (log) {
        log.innerHTML = '';
      }
    });
  }
  
  // Add a log entry
  window.debugLog = function(message) {
    console.log(message);
    const log = document.getElementById('debug-log');
    if (log) {
      const time = new Date().toLocaleTimeString();
      const entry = document.createElement('div');
      entry.innerHTML = `<span style="color: #aaa; font-size: 0.8em;">${time}</span> ${message}`;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }
  };
  
  // Function to attach handlers to TMG buttons
  function attachTMGHandlers() {
    const tmgButtons = document.querySelectorAll('.tmg-button');
    debugLog(`Found ${tmgButtons.length} TMG buttons, attaching handlers`);
    
    tmgButtons.forEach((btn, index) => {
      // Remove existing handlers to avoid duplicates
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add an id for easier debugging
      newBtn.id = newBtn.id || `tmg-btn-${index}`;
      debugLog(`Set up TMG button: ${newBtn.id}`);
      
      // Add direct onclick handler
      newBtn.setAttribute('onclick', 'handleTMGBtnClick(this)');
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        debugLog(`TMG button ${newBtn.id} clicked via event listener`);
        handleTMGBtnClick(this);
      });
    });
  }
  
  // Initialize when the DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, creating debug panel');
    createDebugPanel();
    debugLog('Debug panel initialized');
    
    // Debug the project modal buttons
    const newProjectBtn = document.querySelector('[data-bs-target="#newProjectModal"]');
    if (newProjectBtn) {
      debugLog('Found New Project button');
      newProjectBtn.addEventListener('click', function() {
        debugLog('New Project button clicked');
      });
    } else {
      debugLog('ERROR: New Project button not found');
    }
    
    setTimeout(function() {
      const saveBtn = document.getElementById('saveNewProject');
      if (saveBtn) {
        debugLog('Found Save Project button');
        saveBtn.addEventListener('click', function() {
          debugLog('Save Project button clicked');
        });
      } else {
        debugLog('ERROR: Save Project button not found');
      }
      
      const addComponentBtn = document.getElementById('addComponentRow');
      if (addComponentBtn) {
        debugLog('Found Add Component button');
        addComponentBtn.addEventListener('click', function() {
          debugLog('Add Component button clicked');
          
          // Find and attach handlers to all TMG buttons after a new component is added
          setTimeout(function() {
            attachTMGHandlers();
          }, 500);
        });
      } else {
        debugLog('ERROR: Add Component button not found');
      }
      
      // Initial TMG button handlers
      attachTMGHandlers();
      
      // Test direct TMG redirection
      window.handleTMGBtnClick = function(element) {
        debugLog('TMG button clicked via direct handler');
        const row = element.closest('tr');
        const nameInput = row.querySelector('.component-name');
        
        if (nameInput && nameInput.value.trim()) {
          const name = nameInput.value.trim();
          debugLog(`TMG clicked for component: ${name}`);
          
          // Show confirmation
          if (confirm(`Generate threat model for ${name}?`)) {
            debugLog(`Redirecting to create page with subject=${name}`);
            window.location.href = `/create?subject=${encodeURIComponent(name)}`;
          }
        } else {
          alert('Please provide a component name first');
          debugLog('TMG error: No component name provided');
        }
      };
    }, 1000);
  });
})();
