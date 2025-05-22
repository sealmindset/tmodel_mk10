/**
 * Rapid7 Bypass Script
 * This script adds a direct bypass button to the Rapid7 settings form
 * to save settings without validation
 */
document.addEventListener('DOMContentLoaded', function() {
  // Find the Rapid7 form
  const rapid7Form = document.getElementById('rapid7-settings-form');
  
  if (rapid7Form) {
    // Find the button container
    const buttonContainer = rapid7Form.querySelector('.d-flex');
    
    if (buttonContainer) {
      // Create the bypass button
      const bypassButton = document.createElement('button');
      bypassButton.type = 'button';
      bypassButton.className = 'btn btn-warning me-2';
      bypassButton.id = 'bypass-rapid7-settings';
      bypassButton.textContent = 'Direct Save (Bypass Validation)';
      
      // Insert the bypass button before the span
      const resultSpan = buttonContainer.querySelector('#test-rapid7-result');
      if (resultSpan) {
        buttonContainer.insertBefore(bypassButton, resultSpan);
      } else {
        buttonContainer.appendChild(bypassButton);
      }
      
      // Add event listener to the bypass button
      bypassButton.addEventListener('click', async function() {
        try {
          // Get form values
          const apiUrl = document.getElementById('rapid7-api-url').value;
          const apiKey = document.getElementById('rapid7-api-key').value;
          
          // Show saving indicator
          const resultSpan = document.getElementById('test-rapid7-result');
          resultSpan.textContent = 'Saving settings directly...';
          resultSpan.className = 'ms-2 text-info';
          
          // Send request to our bypass endpoint
          const response = await fetch('/rapid7-bypass/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              apiUrl,
              apiKey
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            resultSpan.textContent = 'Settings saved successfully (bypassed validation)';
            resultSpan.className = 'ms-2 text-success';
            
            // Test connection after saving
            testRapid7Connection();
          } else {
            resultSpan.textContent = 'Error saving settings: ' + data.message;
            resultSpan.className = 'ms-2 text-danger';
          }
        } catch (error) {
          console.error('Error saving Rapid7 settings:', error);
          const resultSpan = document.getElementById('test-rapid7-result');
          resultSpan.textContent = 'Error: ' + error.message;
          resultSpan.className = 'ms-2 text-danger';
        }
      });
    }
  }
  
  // Helper function to test connection
  async function testRapid7Connection() {
    try {
      const resultSpan = document.getElementById('test-rapid7-result');
      resultSpan.textContent = 'Testing connection...';
      resultSpan.className = 'ms-2 text-info';
      
      const response = await fetch('/rapid7-bypass/test');
      const data = await response.json();
      
      if (data.success) {
        resultSpan.textContent = 'Connection successful';
        resultSpan.className = 'ms-2 text-success';
        
        // Update status indicator
        const statusIndicator = document.querySelector('#rapid7-tab .status-dot');
        if (statusIndicator) {
          statusIndicator.classList.remove('status-red');
          statusIndicator.classList.add('status-green');
        }
        
        // Update status text
        const statusText = document.getElementById('rapid7-status-text');
        if (statusText) {
          statusText.textContent = 'Connected';
          statusText.className = 'ms-2 text-success';
        }
      } else {
        resultSpan.textContent = data.message;
        resultSpan.className = 'ms-2 text-danger';
      }
    } catch (error) {
      console.error('Error testing Rapid7 connection:', error);
      const resultSpan = document.getElementById('test-rapid7-result');
      resultSpan.textContent = 'Error: ' + error.message;
      resultSpan.className = 'ms-2 text-danger';
    }
  }
});
