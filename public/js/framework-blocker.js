/**
 * Framework Blocker
 * This script intercepts and disables the component framework that's
 * creating unwanted elements with data-component-name attributes.
 * Enhanced version to more aggressively clean up unwanted divs
 */

(function() {
  // Store references to original methods we'll override
  const originalCreateElement = document.createElement;
  const originalAppendChild = Node.prototype.appendChild;
  const originalInsertBefore = Node.prototype.insertBefore;
  const originalReplaceChild = Node.prototype.replaceChild;
  
  // Set of allowed form elements that should keep their data-component-name
  const ALLOWED_ELEMENTS = new Set(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']);
  
  // Override createElement to monitor new elements
  document.createElement = function(tagName, options) {
    const element = originalCreateElement.call(document, tagName, options);
    
    // Add a property that we can check later
    element._frameworkBlocked = true;
    
    return element;
  };
  
  // Override appendChild to block components
  Node.prototype.appendChild = function(node) {
    // If it has the data-component-name attribute, don't add it
    if (node.nodeType === 1 && 
        node.getAttribute && 
        node.getAttribute('data-component-name') && 
        !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(node.tagName)) {
      console.log('Blocked appendChild:', node.tagName, node.getAttribute('data-component-name'));
      return node; // Return the node but don't append it
    }
    
    return originalAppendChild.call(this, node);
  };
  
  // Override insertBefore to block components
  Node.prototype.insertBefore = function(node, referenceNode) {
    // If it has the data-component-name attribute, don't insert it
    if (node.nodeType === 1 && 
        node.getAttribute && 
        node.getAttribute('data-component-name') && 
        !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(node.tagName)) {
      console.log('Blocked insertBefore:', node.tagName, node.getAttribute('data-component-name'));
      return node; // Return the node but don't insert it
    }
    
    return originalInsertBefore.call(this, node, referenceNode);
  };
  
  // Override replaceChild to block components
  Node.prototype.replaceChild = function(newNode, oldNode) {
    // If it has the data-component-name attribute, don't replace
    if (newNode.nodeType === 1 && 
        newNode.getAttribute && 
        newNode.getAttribute('data-component-name') && 
        !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(newNode.tagName)) {
      console.log('Blocked replaceChild:', newNode.tagName, newNode.getAttribute('data-component-name'));
      return oldNode; // Return the old node and don't replace it
    }
    
    return originalReplaceChild.call(this, newNode, oldNode);
  };
  
  // More aggressive cleanup function
  function cleanupUnwantedElements() {
    // Remove any existing unwanted components with data-component-name
    const unwanted = document.querySelectorAll('[data-component-name]:not(input):not(button):not(select):not(textarea)');
    let removedCount = 0;
    
    unwanted.forEach(el => {
      if (el.parentNode) {
        // Only log if verbose logging is enabled
        if (window.frameworkBlockerVerbose) {
          console.log('Removing component:', el.tagName, el.getAttribute('data-component-name'));
        }
        
        // Clean up the element's attributes to prevent detection by component frameworks
        el.removeAttribute('data-component-name');
        
        // For empty divs with no meaningful content, remove them entirely
        if (el.tagName === 'DIV' && (!el.textContent || el.textContent.trim() === '') && el.children.length === 0) {
          el.parentNode.removeChild(el);
          removedCount++;
        }
      }
    });
    
    // Additional cleanup for specific tab elements
    cleanupSettingsTabs();
    
    if (removedCount > 0) {
      console.log(`Framework Blocker: Removed ${removedCount} empty div elements`);
    }
    
    return removedCount;
  }
  
  // Specific cleanup for settings tabs
  function cleanupSettingsTabs() {
    // Target all elements in the settings tab content
    if (document.getElementById('settingsTabContent')) {
      // Process all tab panes
      const tabPanes = document.querySelectorAll('.tab-pane');
      tabPanes.forEach(pane => {
        // Find all divs within this tab pane
        const allDivs = pane.querySelectorAll('div');
        allDivs.forEach(div => {
          // If it's an empty div with unnecessary whitespace, clean it up
          const isEmpty = (!div.textContent || div.textContent.trim() === '');
          const hasNoChildren = div.children.length === 0;
          const hasNoAttributes = div.attributes.length === 0 || 
                                 (div.attributes.length === 1 && div.hasAttribute('data-component-name'));
          
          if (isEmpty && (hasNoChildren || hasNoAttributes)) {
            if (div.parentNode) {
              div.parentNode.removeChild(div);
            }
          }
        });
        
        // Remove unwanted whitespace nodes
        cleanWhitespaceNodes(pane);
      });
    }
  }
  
  // Function to clean up text nodes that contain only whitespace
  function cleanWhitespaceNodes(element) {
    // Get all child nodes including text nodes
    const childNodes = element.childNodes;
    
    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i];
      
      // If it's a text node with only whitespace
      if (node.nodeType === 3 && node.textContent.trim() === '') {
        element.removeChild(node);
      } 
      // If it's an element, recursively clean its whitespace
      else if (node.nodeType === 1) {
        cleanWhitespaceNodes(node);
      }
    }
  }
  
  // Run cleanup on page load
  document.addEventListener('DOMContentLoaded', function() {
    // Wait a short moment for all elements to be fully loaded
    setTimeout(() => {
      cleanupUnwantedElements();
      console.log('Framework Blocker initialized - intercepting unwanted components');
    }, 100);
    
    // Set an interval to periodically clean up unwanted elements
    const cleanupInterval = setInterval(cleanupUnwantedElements, 500); // Check twice per second
    
    // Add special handling for tab changes
    const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');
    tabButtons.forEach(btn => {
      btn.addEventListener('shown.bs.tab', () => {
        // Clean up the newly shown tab
        setTimeout(cleanupUnwantedElements, 50);
      });
    });
  });
  
  // Also look for any framework initialization and try to disable it
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, delay) {
    // If the framework uses setTimeout to initialize, we'll disable that
    if (delay === 0 || delay < 50) {
      const callbackString = callback.toString();
      // Check if this might be a framework initialization
      if (callbackString.includes('component') || 
          callbackString.includes('render') ||
          callbackString.includes('createElement')) {
        console.log('Potentially blocked framework initialization');
        return null; // Don't actually schedule the timeout
      }
    }
    
    return originalSetTimeout.call(window, callback, delay);
  };
  
  // Expose cleanup function for manual trigger
  window.cleanupFrameworkComponents = cleanupUnwantedElements;
  
  // Add a mutation observer to detect and clean up new unwanted elements
  const observer = new MutationObserver(function(mutations) {
    let shouldCleanup = false;
    
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === 1 && node.getAttribute && node.getAttribute('data-component-name')) {
            shouldCleanup = true;
            break;
          }
        }
      }
    });
    
    if (shouldCleanup) {
      cleanupUnwantedElements();
    }
  });
  
  // Start observing the document body
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-component-name']
  });
  
  console.log('Enhanced Framework Blocker installed');
})();
