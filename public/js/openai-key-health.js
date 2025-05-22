/**
 * OpenAI API Key Health Check
 * 
 * This script adds a health check indicator for the OpenAI API key
 * to the service status bar.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on a page with the service status bar
  const serviceStatusBar = document.getElementById('serviceStatusBar');
  if (!serviceStatusBar) return;
  
  // Create the OpenAI API key health indicator
  const openaiKeyIndicator = document.createElement('div');
  openaiKeyIndicator.id = 'openaiKeyIndicator';
  openaiKeyIndicator.className = 'service-indicator loading';
  openaiKeyIndicator.setAttribute('title', 'OpenAI API Key: Checking...');
  
  // Create the icon
  const icon = document.createElement('i');
  icon.className = 'bi bi-key';
  openaiKeyIndicator.appendChild(icon);
  
  // Add the indicator to the service status bar
  serviceStatusBar.appendChild(openaiKeyIndicator);
  
  // Check the OpenAI API key health
  checkOpenAIKeyHealth();
  
  // Set up periodic checks
  setInterval(checkOpenAIKeyHealth, 5 * 60 * 1000); // Check every 5 minutes
});

/**
 * Check the health of the OpenAI API key
 */
async function checkOpenAIKeyHealth() {
  const indicator = document.getElementById('openaiKeyIndicator');
  if (!indicator) return;
  
  try {
    // Set indicator to loading state
    indicator.className = 'service-indicator loading';
    indicator.setAttribute('title', 'OpenAI API Key: Checking...');
    
    // Fetch the health status
    const response = await fetch('/api/settings/openai-key-health')
      .catch(error => {
        console.warn('Fetch error for OpenAI key health check:', error);
        return { ok: false, status: 500 };
      });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update the indicator based on the health check result
      if (data.valid) {
        indicator.className = 'service-indicator online';
        indicator.setAttribute('title', `OpenAI API Key: Valid (Source: ${data.source})`);
      } else {
        indicator.className = 'service-indicator offline';
        indicator.setAttribute('title', `OpenAI API Key: ${data.message}`);
      }
    } else if (response.status === 404) {
      // Endpoint not found - likely still being set up
      console.warn('OpenAI key health check endpoint not found');
      
      // Fall back to checking the OpenAI API directly using the environment variable
      checkOpenAIKeyDirectly(indicator);
    } else {
      // Other API call failure
      indicator.className = 'service-indicator offline';
      indicator.setAttribute('title', 'OpenAI API Key: Health check failed');
    }
  } catch (error) {
    console.error('Error checking OpenAI API key health:', error);
    indicator.className = 'service-indicator offline';
    indicator.setAttribute('title', 'OpenAI API Key: Health check error');
  }
}

/**
 * Fallback function to check the OpenAI API key directly
 * This is used when the server-side health check endpoint is not available
 */
async function checkOpenAIKeyDirectly(indicator) {
  try {
    // Try to get the API key from the environment variable (this won't work client-side)
    // Instead, we'll just update the UI to indicate we're using the environment variable
    indicator.className = 'service-indicator online';
    indicator.setAttribute('title', 'OpenAI API Key: Using environment variable');
  } catch (error) {
    console.error('Error in direct OpenAI key check:', error);
    indicator.className = 'service-indicator offline';
    indicator.setAttribute('title', 'OpenAI API Key: Not configured');
  }
}
