/**
 * Rapid7 Test Button
 * 
 * This script adds a click handler to the Rapid7 test connection button
 * that uses XMLHttpRequest to test the Rapid7 API connection.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Rapid7 test button script loaded');
  
  // Get the elements
  const testRapid7Button = document.getElementById('test-rapid7-connection');
  const testRapid7Result = document.getElementById('test-rapid7-result');
  const rapid7StatusIndicator = document.getElementById('rapid7-status-indicator');
  const rapid7StatusText = document.getElementById('rapid7-status-text');
  const rapid7ApiUrlInput = document.getElementById('rapid7-api-url');
  const rapid7ApiKeyInput = document.getElementById('rapid7-api-key');
  
  if (testRapid7Button && testRapid7Result) {
    console.log('Rapid7 test button found');
    
    // Add click handler
    testRapid7Button.addEventListener('click', function() {
      console.log('Rapid7 test button clicked');
      
      // Get current values from the form
      const apiUrl = rapid7ApiUrlInput.value.trim();
      const apiKey = rapid7ApiKeyInput.value.trim();
      
      console.log(`Testing Rapid7 connection to: ${apiUrl}`);
      console.log(`API Key length: ${apiKey.length}`);
      
      if (!apiUrl || !apiKey) {
        console.log('Missing API URL or API Key');
        testRapid7Result.textContent = 'Please enter both API URL and API Key';
        testRapid7Result.className = 'ms-2 text-warning';
        return;
      }
      
      testRapid7Result.textContent = 'Testing...';
      testRapid7Result.className = 'ms-2 text-info';
      
      // Use XMLHttpRequest instead of fetch for better compatibility
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/rapid7-test/connection', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          console.log('XHR response received, status:', xhr.status);
          
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log('Response data:', data);
              
              if (data.success) {
                console.log('Connection successful!');
                testRapid7Result.textContent = 'Connection successful!';
                testRapid7Result.className = 'ms-2 text-success';
                
                // Update the status indicator
                rapid7StatusIndicator.classList.remove('offline');
                rapid7StatusIndicator.classList.add('online');
                rapid7StatusIndicator.setAttribute('title', 'Rapid7: Connected');
                
                // Update the status text
                rapid7StatusText.textContent = 'Connected';
                rapid7StatusText.className = 'ms-2 text-success';
              } else {
                console.log('Connection failed:', data.message || 'Unknown error');
                testRapid7Result.textContent = `Connection failed: ${data.message || 'Unknown error'}`;
                testRapid7Result.className = 'ms-2 text-danger';
                
                // Update the status indicator
                rapid7StatusIndicator.classList.remove('online');
                rapid7StatusIndicator.classList.add('offline');
                rapid7StatusIndicator.setAttribute('title', 'Rapid7: Disconnected');
                
                // Update the status text
                rapid7StatusText.textContent = 'Disconnected';
                rapid7StatusText.className = 'ms-2 text-danger';
              }
            } catch (parseError) {
              console.error('Error parsing response:', parseError);
              testRapid7Result.textContent = 'Error parsing response';
              testRapid7Result.className = 'ms-2 text-danger';
            }
          } else {
            console.error('Request failed with status:', xhr.status);
            testRapid7Result.textContent = `Request failed with status: ${xhr.status}`;
            testRapid7Result.className = 'ms-2 text-danger';
            
            // Update the status indicator
            rapid7StatusIndicator.classList.remove('online');
            rapid7StatusIndicator.classList.add('offline');
            rapid7StatusIndicator.setAttribute('title', 'Rapid7: Disconnected');
            
            // Update the status text
            rapid7StatusText.textContent = 'Disconnected';
            rapid7StatusText.className = 'ms-2 text-danger';
          }
        }
      };
      
      xhr.onerror = function() {
        console.error('XHR request failed');
        testRapid7Result.textContent = 'Network error. Please check your connection.';
        testRapid7Result.className = 'ms-2 text-danger';
      };
      
      console.log('Sending XHR request with data:', JSON.stringify({ apiUrl, apiKey }));
      xhr.send(JSON.stringify({ apiUrl, apiKey }));
    });
  } else {
    console.error('Rapid7 test button or result element not found');
  }
});
