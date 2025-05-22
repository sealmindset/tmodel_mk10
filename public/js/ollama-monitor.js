document.addEventListener('DOMContentLoaded', function() {
  console.log('Ollama Monitor: Initializing...');
  // DOM Elements
  const modal = document.getElementById('ollamaMonitorModal');
  const eventsContainer = document.getElementById('ollama-api-events-container');
  const eventsList = document.getElementById('ollama-events-list');
  const noEventsMessage = document.getElementById('ollama-no-events-message');
  const eventsCountEl = document.getElementById('ollama-events-count');
  const apiStatusBadge = document.getElementById('ollama-api-status-badge');
  const refreshBtn = document.getElementById('ollama-refresh-events-btn');
  const autoRefreshToggle = document.getElementById('ollama-auto-refresh-toggle');
  const clearEventsBtn = document.getElementById('ollama-clear-events-btn');
  const filterButtons = document.querySelectorAll('.ollama-filter-btn');
  const template = document.getElementById('ollama-event-item-template');
  
  // State variables
  let events = [];
  let autoRefreshInterval = null;
  let currentFilter = 'all';
  const AUTO_REFRESH_INTERVAL = 3000; // 3 seconds
  
  // Initialize the monitor when the modal is first shown
  if (modal) {
    console.log('Ollama Monitor: Modal element found');
    modal.addEventListener('show.bs.modal', function() {
      console.log('Ollama Monitor: Modal shown');
      fetchEvents();
    });
    
    // Set up auto-refresh toggle
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', toggleAutoRefresh);
      // Initial setup of auto-refresh
      if (autoRefreshToggle.checked) {
        startAutoRefresh();
      }
    }
    
    // Manual refresh button
    if (refreshBtn) {
      refreshBtn.addEventListener('click', fetchEvents);
    }
    
    // Clear events button
    if (clearEventsBtn) {
      clearEventsBtn.addEventListener('click', clearEvents);
    }
    
    // Filter buttons
    if (filterButtons) {
      filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
          // Update active button
          filterButtons.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          
          // Apply filter
          currentFilter = this.dataset.filter;
          renderEvents();
        });
      });
    }
    
    // Handle modal close - stop auto refresh
    modal.addEventListener('hidden.bs.modal', function() {
      stopAutoRefresh();
    });
  } else {
    console.error('Ollama Monitor: Modal element not found');
    // Create a debug message for developers (will be hidden in production)
    if (document.querySelector('body.debug-mode')) {
      const debugDiv = document.createElement('div');
      debugDiv.className = 'alert alert-warning fixed-bottom m-3';
      debugDiv.innerHTML = 'Ollama Monitor: Modal not found. Check the console for details.';
      document.body.appendChild(debugDiv);
    }
  }
  
  /**
   * Start auto-refreshing events
   */
  function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing interval first
    autoRefreshInterval = setInterval(fetchEvents, AUTO_REFRESH_INTERVAL);
  }
  
  /**
   * Stop auto-refreshing events
   */
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }
  
  /**
   * Toggle auto-refresh based on checkbox state
   */
  function toggleAutoRefresh() {
    if (this.checked) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }
  
  /**
   * Fetch events from the API
   */
  function fetchEvents() {
    console.log('Ollama Monitor: Fetching events...');
    // Add spinner to refresh button
    if (refreshBtn) {
      refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Refreshing...';
      refreshBtn.disabled = true;
    }
    
    // Use the LLM events endpoint with the Ollama provider specified
    fetch('/api/llm/events?provider=ollama')
      .then(response => {
        console.log('Ollama Monitor: Response status:', response.status);
        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Ollama Monitor: Received events:', data ? data.length : 0);
        events = data || [];
        updateApiStatus(true);
        renderEvents();
      })
      .catch(error => {
        console.error('Error fetching Ollama events:', error);
        updateApiStatus(false);
        // Show error in the events container
        if (eventsList) {
          eventsList.innerHTML = `<div class="alert alert-danger m-3">Error loading events: ${error.message}</div>`;
          noEventsMessage.classList.add('d-none');
          eventsList.classList.remove('d-none');
        }
      })
      .finally(() => {
        // Restore refresh button
        if (refreshBtn) {
          refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh';
          refreshBtn.disabled = false;
        }
      });
  }
  
  /**
   * Update the API status indicator
   */
  function updateApiStatus(isOnline) {
    if (apiStatusBadge) {
      if (isOnline) {
        apiStatusBadge.className = 'badge rounded-pill bg-success';
        apiStatusBadge.textContent = 'Connected';
      } else {
        apiStatusBadge.className = 'badge rounded-pill bg-danger';
        apiStatusBadge.textContent = 'Offline';
      }
    }
  }
  
  /**
   * Clear all events
   */
  function clearEvents() {
    events = [];
    renderEvents();
  }
  
  /**
   * Render events based on current filter
   */
  function renderEvents() {
    if (!eventsList || !noEventsMessage || !eventsCountEl) return;
    
    // Filter events
    let filteredEvents = events;
    if (currentFilter !== 'all') {
      filteredEvents = events.filter(event => event.type === currentFilter);
    }
    
    // Update events count
    eventsCountEl.textContent = events.length;
    
    // If no events, show message
    if (filteredEvents.length === 0) {
      eventsList.classList.add('d-none');
      noEventsMessage.classList.remove('d-none');
      return;
    }
    
    // Otherwise show events
    noEventsMessage.classList.add('d-none');
    eventsList.classList.remove('d-none');
    
    // Clear previous events
    eventsList.innerHTML = '';
    
    // Add events
    filteredEvents.forEach(event => {
      const eventEl = createEventElement(event);
      eventsList.appendChild(eventEl);
    });
  }
  
  /**
   * Create an event element from template
   */
  function createEventElement(event) {
    if (!template) return document.createElement('div');
    
    const clone = template.content.cloneNode(true);
    const eventEl = clone.querySelector('.event-item');
    
    // Add event type class
    eventEl.classList.add(`event-${event.type}`);
    
    // Set event badge
    const badgeEl = clone.querySelector('.event-type');
    switch (event.type) {
      case 'request':
        badgeEl.textContent = 'Request';
        badgeEl.classList.add('bg-primary');
        break;
      case 'response':
        badgeEl.textContent = 'Response';
        badgeEl.classList.add('bg-success');
        break;
      case 'error':
        badgeEl.textContent = 'Error';
        badgeEl.classList.add('bg-danger');
        break;
      default:
        badgeEl.textContent = event.type;
        badgeEl.classList.add('bg-secondary');
    }
    
    // Set timestamp
    const timeEl = clone.querySelector('.event-time');
    const timestamp = new Date(event.timestamp);
    timeEl.textContent = timestamp.toLocaleTimeString();
    
    // Set summary
    const summaryEl = clone.querySelector('.event-summary');
    if (event.type === 'request') {
      const model = event.data.model || 'Unknown model';
      let promptPreview = 'No prompt data';
      
      if (event.data.prompt) {
        promptPreview = `"${event.data.prompt.substring(0, 50)}${event.data.prompt.length > 50 ? '...' : ''}"`;
      }
      
      let techniques = [];
      if (event.data.usesCag) techniques.push('<span class="badge bg-info">CAG</span>');
      if (event.data.usesRag) techniques.push('<span class="badge bg-warning">RAG</span>');
      
      let techniquesHtml = techniques.length ? `<br><strong>Techniques:</strong> ${techniques.join(' ')}` : '';
      
      summaryEl.innerHTML = `<strong>Model:</strong> ${model}<br><strong>Prompt:</strong> ${promptPreview}${techniquesHtml}`;
    } else if (event.type === 'response') {
      let responseText = '';
      if (event.data.response) {
        responseText = event.data.response.substring(0, 50) + (event.data.response.length > 50 ? '...' : '');
      } else if (event.data.choices && event.data.choices.length > 0) {
        if (event.data.choices[0].message) {
          responseText = event.data.choices[0].message.content || '';
        } else {
          responseText = event.data.choices[0].text || '';
        }
        responseText = responseText.substring(0, 50) + (responseText.length > 50 ? '...' : '');
      }
      
      const timeInfo = event.data.processingTime ? `Time: ${event.data.processingTime}` : '';
      summaryEl.innerHTML = `<strong>Response:</strong> "${responseText}"<br><strong>${timeInfo}</strong>`;
    } else if (event.type === 'error') {
      summaryEl.innerHTML = `<strong>Error:</strong> ${event.data.message || 'Unknown error'}`;
    }
    
    // Set data and configure collapse
    const collapseId = `ollama-collapse-${event.id}`;
    const collapseEl = clone.querySelector('.collapse');
    collapseEl.id = collapseId;
    
    const toggleBtn = clone.querySelector('.toggle-details');
    toggleBtn.setAttribute('data-target', collapseId);
    
    const dataEl = clone.querySelector('.event-data');
    dataEl.textContent = JSON.stringify(event.data, null, 2);
    
    return eventEl;
  }
  
  // Export functions for global access
  window.ollamaMonitor = {
    refresh: fetchEvents,
    clear: clearEvents,
    toggle: function() {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modal);
      modalInstance.toggle();
    }
  };
});

// Add a keyboard shortcut to open the monitor (Ctrl+Shift+L)
document.addEventListener('keydown', function(event) {
  if (event.ctrlKey && event.shiftKey && event.key === 'L') {
    if (window.ollamaMonitor) {
      window.ollamaMonitor.toggle();
    }
  }
});
