/**
 * Threat Highlighting JavaScript
 * Adds visual indicators to threats that were recently added through merge
 * 
 * Version 1.2.0 - Enhanced to support both data attributes and window.threatModelData
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing threat highlighting system');
  
  // Check if highlighting was triggered from merge page via URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const highlightRequested = urlParams.get('highlight') === 'merged';
  
  if (highlightRequested) {
    console.log('Auto-highlighting requested via URL parameter');
  }
  
  // Find and highlight newly merged threats
  highlightNewlyMergedThreats(highlightRequested);
  
  // Add legend if there are highlighted threats
  addMergeLegendIfNeeded();
  
  // Handle modal events for newly added threats
  setupModalEventListeners();
});

/**
 * Highlights threats that were recently merged
 * - Supports both data-attribute flagged threats and window.threatModelData
 * @param {boolean} forceHighlight - When true, forces highlighting even without explicit data attributes
 */
function highlightNewlyMergedThreats(forceHighlight = false) {
  // Count of newly merged threats found
  let highlightedCount = 0;
  
  // Find all threats with the "is-new-from-merge" data attribute
  const newThreats = document.querySelectorAll('[data-is-new-from-merge="true"]');
  
  if (newThreats.length > 0) {
    console.log(`Found ${newThreats.length} threats with data-is-new-from-merge attribute`);
    highlightedCount += newThreats.length;
    
    // Add highlighting class and badge to each new threat
    newThreats.forEach(threat => {
      // Add highlighting class
      threat.classList.add('threat-new-from-merge');
      
      // Add "NEW" badge to the title if it doesn't already have one
      const titleElement = threat.querySelector('.threat-title, .card-title, h5');
      if (titleElement && !titleElement.querySelector('.threat-new-badge')) {
        const badge = document.createElement('span');
        badge.className = 'threat-new-badge ms-2';
        badge.textContent = 'NEW';
        badge.setAttribute('title', 'Recently added through merge');
        badge.setAttribute('data-bs-toggle', 'tooltip');
        titleElement.appendChild(badge);
      }
    });
  }
  
  // Now check if we have any window.threatModelData with newMergedThreats
  if ((forceHighlight || (window.threatModelData && window.threatModelData.newMergedThreats && window.threatModelData.newMergedThreats.length)) && window.threatModelData) {
    console.log(`Processing threats from threatModelData${forceHighlight ? ' (forced highlighting active)' : ''}`);
    
    // Get threat names from the window.threatModelData
    const newMergedThreatNames = window.threatModelData.newMergedThreats.map(threat => threat.name);
    
    // Find threats in the document by name matching
    document.querySelectorAll('.card-title, h5, .threat-title').forEach(titleElement => {
      const threatName = titleElement.textContent.trim().split('\n')[0].trim();
      
      if (newMergedThreatNames.includes(threatName)) {
        // This is a newly merged threat based on the name
        const threatElement = titleElement.closest('.card, li, .threat-item');
        
        if (threatElement && !threatElement.classList.contains('threat-new-from-merge')) {
          // Only add highlighting if not already added
          threatElement.classList.add('threat-new-from-merge');
          threatElement.setAttribute('data-is-new-from-merge', 'true');
          
          // Add badge if not already added
          if (!titleElement.querySelector('.threat-new-badge')) {
            const badge = document.createElement('span');
            badge.className = 'threat-new-badge ms-2';
            badge.textContent = 'NEW';
            badge.setAttribute('title', 'Recently added through merge');
            badge.setAttribute('data-bs-toggle', 'tooltip');
            titleElement.appendChild(badge);
          }
          
          highlightedCount++;
        }
      }
    });
  }
  
  // Initialize tooltips for all newly added badges
  if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
    const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltips.map(function (tooltipTrigger) {
      return new bootstrap.Tooltip(tooltipTrigger);
    });
  }
  
  return highlightedCount;
}

/**
 * Adds a legend explaining the highlighting if there are highlighted threats
 */
function addMergeLegendIfNeeded() {
  // First check if a legend already exists to avoid duplicates
  if (document.querySelector('.merge-legend')) {
    return;
  }
  
  // Count highlighted threats
  const newThreats = document.querySelectorAll('.threat-new-from-merge');
  let threatCount = newThreats.length;
  
  // Also check if threat count is available from the data
  if (window.threatModelData && window.threatModelData.newMergedThreatCount) {
    threatCount = Math.max(threatCount, window.threatModelData.newMergedThreatCount);
  }
  
  if (threatCount > 0) {
    // Find appropriate container for the legend
    const container = document.querySelector('.card-header, .threat-list-header, .threats-container, .card-title');
    
    if (container) {
      // Create legend element
      const legend = document.createElement('div');
      legend.className = 'merge-legend mt-3 mb-2';
      legend.innerHTML = `
        <div class="merge-legend-indicator"></div>
        <span>${threatCount} new threat${threatCount > 1 ? 's' : ''} added from recent merge</span>
      `;
      
      // Insert after container
      container.insertAdjacentElement('afterend', legend);
    }
  }
}

/**
 * Setup event listeners for modals to properly highlight threats
 * when they are loaded dynamically
 */
function setupModalEventListeners() {
  // When the threats modal is shown, highlight any newly merged threats
  document.addEventListener('shown.bs.modal', function(event) {
    if (event.target.id === 'threatsModal') {
      // Small delay to ensure content is fully loaded
      setTimeout(() => {
        highlightNewlyMergedThreats();
      }, 100);
    }
  });
}
