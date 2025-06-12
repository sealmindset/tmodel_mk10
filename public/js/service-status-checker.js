/**
 * Service Status Checker
 * 
 * Periodically checks Redis, PostgreSQL, Rapid7, OpenAI, and Ollama status and updates the indicators
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips
  const initializeTooltips = () => {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  };

  // Get all status indicators
  const redisIndicator = document.getElementById('redis-status');
  const postgresIndicator = document.getElementById('postgres-status');
  const rapid7Indicator = document.getElementById('rapid7-status');
  const openaiIndicator = document.getElementById('openai-status');
  const ollamaIndicator = document.getElementById('ollama-status');
  
  // Check if indicators exist in the DOM
  if (redisIndicator && openaiIndicator) {
    // Set initial loading state for all indicators
    redisIndicator.classList.add('loading');
    postgresIndicator?.classList.add('loading');
    rapid7Indicator?.classList.add('loading');
    openaiIndicator.classList.add('loading');
    ollamaIndicator?.classList.add('loading');
    
    // Initialize tooltips
    initializeTooltips();
    
    // Function to update status indicators
    const updateStatusIndicators = (statusData) => {
      // Update PostgreSQL status
      if (postgresIndicator) {
        postgresIndicator.classList.remove('loading', 'online', 'offline');
        postgresIndicator.classList.add(statusData.postgres ? 'online' : 'offline');
        postgresIndicator.setAttribute('title', `PostgreSQL: ${statusData.postgres ? 'Connected' : 'Disconnected'}`);
      }
      
      // Update Rapid7 status
      if (rapid7Indicator) {
        rapid7Indicator.classList.remove('loading', 'online', 'offline');
        rapid7Indicator.classList.add(statusData.rapid7 ? 'online' : 'offline');
        rapid7Indicator.setAttribute('title', `Rapid7 API: ${statusData.rapid7 ? 'Connected' : 'Disconnected'}`);
      }
      
      // Update OpenAI status
      if (openaiIndicator) {
        openaiIndicator.classList.remove('loading', 'online', 'offline');
        openaiIndicator.classList.add(statusData.openai ? 'online' : 'offline');
        openaiIndicator.setAttribute('title', `OpenAI API: ${statusData.openai ? 'Connected' : 'Disconnected'}`);
      }
      
      // Update Ollama status
      if (ollamaIndicator) {
        ollamaIndicator.classList.remove('loading', 'online', 'offline');
        ollamaIndicator.classList.add(statusData.ollama ? 'online' : 'offline');
        ollamaIndicator.setAttribute('title', `Ollama: ${statusData.ollama ? 'Connected' : 'Disconnected'}`);
      }
      
      // Refresh tooltips
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        const tooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
        if (tooltip) {
          tooltip.dispose();
          new bootstrap.Tooltip(tooltipTriggerEl);
        }
      });
    };
    
    // Function to check service status
    const checkServiceStatus = async () => {
      try {
        console.log('[ServiceStatusChecker] Starting service status check...');
        // Initialize a local status object to store service statuses
        let serviceStatus = {
          postgres: false,
          rapid7: false,
          openai: false,
          ollama: false,
          timestamp: new Date().toISOString()
        };
        // Direct check for PostgreSQL using the health endpoint
        if (postgresIndicator) {
          try {
            console.log('[ServiceStatusChecker] Checking PostgreSQL status via /health endpoint');
            const pgResponse = await fetch('/health');
            if (pgResponse.ok) {
              const pgData = await pgResponse.json();
              const isConnected = pgData.db === 'UP';
              // Update the status in our serviceStatus object to ensure consistent updates
              serviceStatus.postgres = isConnected;
              // Immediately update the indicator
              postgresIndicator.classList.remove('loading', 'online', 'offline');
              postgresIndicator.classList.add(isConnected ? 'online' : 'offline');
              postgresIndicator.setAttribute('title', `PostgreSQL: ${isConnected ? 'Connected' : 'Disconnected'}`);
              console.log('[ServiceStatusChecker] Direct PostgreSQL check result:', isConnected ? 'Connected' : 'Disconnected');
            } else {
              console.warn('[ServiceStatusChecker] PostgreSQL health check HTTP error:', pgResponse.status);
              postgresIndicator.classList.remove('loading', 'online', 'offline');
              postgresIndicator.classList.add('offline');
              postgresIndicator.setAttribute('title', 'PostgreSQL: Disconnected');
              serviceStatus.postgres = false;
            }
          } catch (pgError) {
            console.error('[ServiceStatusChecker] Error checking PostgreSQL health:', pgError);
            if (pgError instanceof TypeError && pgError.message && pgError.message.includes('Failed to fetch')) {
              console.error('[ServiceStatusChecker] Likely a CORS or network error when fetching /health.');
            }
            postgresIndicator.classList.remove('loading', 'online', 'offline');
            postgresIndicator.classList.add('offline');
            postgresIndicator.setAttribute('title', 'PostgreSQL: Disconnected');
            serviceStatus.postgres = false;
          }
        }

        // Check Rapid7 API status
        if (rapid7Indicator) {
          // Disable Rapid7 checks completely to avoid CORS errors
          rapid7Indicator.classList.remove('loading', 'online', 'offline');
          rapid7Indicator.classList.add('offline');
          rapid7Indicator.setAttribute('title', 'Rapid7 API: Checks Disabled');
          // Set status in our tracking object
          serviceStatus.rapid7 = false;
        }

        // Now check all services using the status API
        try {
          // Set a timeout for the fetch to prevent long-running requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          // Explicitly exclude Rapid7 to prevent CORS errors
          console.log('[ServiceStatusChecker] Checking /api/status for all services except Rapid7...');
          const response = await fetch('/api/status?forceCheck=true&provider=all&skipRapid7=true', {
            signal: controller.signal,
            // Add cache-busting to prevent cached responses
            headers: { 'Cache-Control': 'no-cache' }
          }).catch(err => {
            // Silently handle network errors
            clearTimeout(timeoutId);
            console.error('[ServiceStatusChecker] Network or CORS error when fetching /api/status:', err);
            return { ok: false };
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            const data = await response.json();
            console.log('[ServiceStatusChecker] Service status check results:', data);
            // Update our serviceStatus object with the API response
            serviceStatus = { ...serviceStatus, ...data };
            // Update the UI with the final status
            updateStatusIndicators(serviceStatus);
            console.log('[ServiceStatusChecker] Status indicators updated with API results.');
            return serviceStatus;
          } else {
            console.error('[ServiceStatusChecker] Service status API call failed with status:', response.status);
            updateStatusIndicators(serviceStatus);
            return serviceStatus;
          }
        } catch (statusError) {
          console.error('[ServiceStatusChecker] Error checking /api/status:', statusError);
          if (statusError instanceof TypeError && statusError.message && statusError.message.includes('Failed to fetch')) {
            console.error('[ServiceStatusChecker] Likely a CORS or network error when fetching /api/status.');
          }
          updateStatusIndicators(serviceStatus);
          return serviceStatus;
        }
      } catch (error) {
        const defaultStatus = {
          postgres: false,
          rapid7: false,
          openai: false,
          ollama: false,
          timestamp: new Date().toISOString()
        };
        console.error('[ServiceStatusChecker] Unexpected error in checkServiceStatus:', error);
        updateStatusIndicators(defaultStatus);
        return defaultStatus;
      }
    };
    
    // Variable to track if we've had a successful check
    let allServicesOnline = false;
    let checkIntervalId = null;
    
    // Function to set the appropriate check interval based on status
    const setCheckInterval = (allOnline) => {
      if (checkIntervalId) {
        clearInterval(checkIntervalId);
        checkIntervalId = null;
      }
      
      // Set hourly check if all services are online, otherwise check every 15 seconds
      const interval = allOnline ? 3600000 : 15000; // 1 hour vs 15 seconds
      checkIntervalId = setInterval(async () => {
        await checkServiceStatus();
      }, interval);
      
      console.log(`Status check frequency set to ${allOnline ? 'hourly' : 'every 15 seconds'}`);
    };
    
    // Initial status check
    checkServiceStatus().then(result => {
      // Check if all critical services are online
      if (result && result.postgres && result.openai) {
        allServicesOnline = true;
        setCheckInterval(true);
      } else {
        setCheckInterval(false);
      }
    });
  }
});
