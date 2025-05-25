/**
 * Reusable Item Assignment Module
 * 
 * This JavaScript module provides a flexible, reusable implementation for
 * item assignment functionality in modals. It can be used to assign any type
 * of items to any entity (e.g., assigning threat models to projects, components
 * to projects, safeguards to components, etc.).
 * 
 * Features:
 * - Dynamic modal creation
 * - Flexible configuration
 * - Standard error handling
 * - Loading states for better UX
 * - Consistent design pattern
 */

class ItemAssignmentManager {
  /**
   * Initialize the assignment manager
   * 
   * @param {Object} config - Configuration object
   * @param {string} config.entityId - ID of the entity items will be assigned to
   * @param {string} config.entityType - Type of entity (e.g., 'project', 'component')
   * @param {string} config.itemType - Type of items being assigned (e.g., 'threat-model', 'safeguard')
   * @param {string} config.modalContainerId - ID of container to append modal to
   * @param {Function} config.onAssignmentComplete - Callback after successful assignment
   * @param {Object} config.apiEndpoints - API endpoints for item assignment
   * @param {string} config.apiEndpoints.getAssigned - API endpoint to get assigned items
   * @param {string} config.apiEndpoints.getUnassigned - API endpoint to get unassigned items
   * @param {string} config.apiEndpoints.assign - API endpoint to assign items
   * @param {string} config.apiEndpoints.remove - API endpoint to remove an item
   * @param {Object} config.labels - Custom labels for the UI
   * @param {string} config.labels.modalTitle - Title for the modal
   * @param {string} config.labels.assignButtonText - Text for the assign button
   * @param {string} config.labels.itemNameSingular - Singular name of item type
   * @param {string} config.labels.itemNamePlural - Plural name of item type
   */
  constructor(config) {
    this.config = {
      entityId: null,
      entityType: 'entity',
      itemType: 'item',
      modalContainerId: 'itemAssignmentModal',
      onAssignmentComplete: () => window.location.reload(),
      apiEndpoints: {
        getAssigned: '',
        getUnassigned: '',
        assign: '',
        remove: ''
      },
      labels: {
        modalTitle: 'Assign Items',
        assignButtonText: 'Assign Selected',
        itemNameSingular: 'item',
        itemNamePlural: 'items'
      },
      ...config
    };

    // Validate required config
    this.validateConfig();
    
    // Initialize state
    this.state = {
      items: {
        assigned: [],
        unassigned: []
      },
      selectedItems: [],
      loading: false,
      error: null,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: 10,
        totalItems: 0
      },
      modalInstance: null
    };

    // Create and initialize the modal
    this.createModal();
    this.setupEventListeners();
  }

  /**
   * Validate the configuration object
   * Throws an error if required fields are missing
   */
  validateConfig() {
    const { entityId, entityType, apiEndpoints } = this.config;
    
    if (!entityId) {
      throw new Error('Entity ID is required');
    }
    
    if (!entityType) {
      throw new Error('Entity type is required');
    }
    
    // Validate API endpoints
    const requiredEndpoints = ['getAssigned', 'getUnassigned', 'assign', 'remove'];
    for (const endpoint of requiredEndpoints) {
      if (!apiEndpoints[endpoint]) {
        throw new Error(`API endpoint for ${endpoint} is required`);
      }
    }
  }

  /**
   * Create the assignment modal
   */
  createModal() {
    const { modalContainerId, labels } = this.config;
    
    // Use the existing modal structure instead of creating a new one
    const modalContainer = document.getElementById(modalContainerId);
    if (!modalContainer) {
      console.error(`Modal container with ID ${modalContainerId} not found`);
      return;
    }

    // Store modal elements for later use
    this.elements = {
      modal: modalContainer,
      loading: document.getElementById(`${modalContainerId}-loading`),
      content: document.getElementById(`${modalContainerId}-content`),
      itemList: document.getElementById(`${modalContainerId}-item-list`),
      searchInput: document.getElementById(`${modalContainerId}-search`),
      assignButton: document.getElementById(`${modalContainerId}-assign-btn`),
      selectedCount: document.getElementById(`${modalContainerId}-selected-count`),
      selectedBadge: document.getElementById(`${modalContainerId}-selected-badge`),
      error: document.getElementById(`${modalContainerId}-error`),
      prevButton: document.getElementById(`${modalContainerId}-prev`),
      nextButton: document.getElementById(`${modalContainerId}-next`),
      pageInfo: document.getElementById(`${modalContainerId}-page-info`),
      selectAllCheckbox: document.getElementById(`${modalContainerId}-select-all`)
    };

    // Verify all required elements exist
    const missingElements = Object.entries(this.elements)
      .filter(([key, value]) => !value && key !== 'error') // error element is optional
      .map(([key]) => key);

    if (missingElements.length > 0) {
      console.error(`Missing required modal elements: ${missingElements.join(', ')}`);
    }
  }

  /**
   * Set up event listeners for the modal
   */
  setupEventListeners() {
    const { modal, searchInput, assignButton, prevButton, nextButton, selectAllCheckbox } = this.elements;
    
    // Modal show event
    $(modal).on('show.bs.modal', () => {
      this.fetchItems();
    });
    
    // Search input
    searchInput.addEventListener('input', e => {
      this.filterItems(e.target.value.toLowerCase());
    });
    
    // Assign button
    assignButton.addEventListener('click', () => {
      this.assignSelectedItems();
    });
    
    // Pagination buttons
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        this.goToPreviousPage();
      });
    }
    
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        this.goToNextPage();
      });
    }
    
    // Select all checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', e => {
        this.toggleSelectAll(e.target.checked);
      });
    }
  }

  /**
   * Open the assignment modal
   */
  open() {
    const { modalContainerId } = this.config;
    const modalElement = document.getElementById(modalContainerId);
    
    if (!modalElement) {
      console.error(`Modal element with ID ${modalContainerId} not found`);
      return;
    }
    
    // Close any existing modals first
    if (window.modalManager) {
      window.modalManager.closeAllModals();
    }

    // Remove any existing modal backdrops
    const existingBackdrops = document.querySelectorAll('.modal-backdrop');
    existingBackdrops.forEach(backdrop => backdrop.remove());

    // Reset modal state
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
    
    // Load items and show the modal
    this.loadItems();
    
    // Check if modal is already initialized
    this.state.modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (!this.state.modalInstance) {
      this.state.modalInstance = new bootstrap.Modal(modalElement);
    }
    
    // Add event listener to cleanup after hiding
    modalElement.addEventListener('hidden.bs.modal', function() {
      // Remove any backdrop elements that might be left over
      const backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(backdrop => backdrop.remove());
      
      // Reset body classes
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('padding-right');
      document.body.style.removeProperty('overflow');
    }, { once: true });
    
    this.state.modalInstance.show();
  }

  /**
   * Close the assignment modal
   */
  close() {
    if (this.state.modalInstance) {
      this.state.modalInstance.hide();
    }
  }

  /**
   * Load items (both assigned and unassigned)
   */
  async loadItems() {
    const { entityId, apiEndpoints } = this.config;
    const { loading, content, error, itemList } = this.elements;
    
    // Reset state
    this.state.selectedItems = [];
    this.state.items = {
      assigned: [],
      unassigned: []
    };
    
    // Show loading, hide content and error
    loading.style.display = 'block';
    content.style.display = 'none';
    error.style.display = 'none';
    
    try {
      // Fetch assigned items
      const assignedResponse = await fetch(apiEndpoints.getAssigned);
      if (!assignedResponse.ok) {
        throw new Error(`Failed to fetch assigned items: ${assignedResponse.status}`);
      }
      const assignedItems = await assignedResponse.json();
      
      // Fetch unassigned items
      const unassignedResponse = await fetch(apiEndpoints.getUnassigned);
      if (!unassignedResponse.ok) {
        throw new Error(`Failed to fetch unassigned items: ${unassignedResponse.status}`);
      }
      const unassignedItems = await unassignedResponse.json();
      
      // Update state
      this.state.items = {
        assigned: assignedItems,
        unassigned: unassignedItems
      };
      
      // Render items
      this.renderItems();
      
      // Hide loading, show content
      loading.style.display = 'none';
      content.style.display = 'block';
    } catch (err) {
      console.error('Error loading items:', err);
      
      // Hide loading, show error
      loading.style.display = 'none';
      error.style.display = 'block';
      error.textContent = `Error loading items: ${err.message}`;
    }
  }

  /**
   * Render items in the modal
   */
  renderItems() {
    const { itemList, searchInput, pageInfo, prevButton, nextButton } = this.elements;
    const { items, selectedItems, pagination } = this.state;
    const { labels } = this.config;
    
    // Clear previous items
    itemList.innerHTML = '';
    
    // Get unassigned items only for the table
    const unassignedItems = items.unassigned || [];
    
    if (unassignedItems.length === 0) {
      // No items available
      itemList.innerHTML = `
        <tr>
          <td colspan="3" class="text-center text-muted">
            No ${labels.itemNamePlural} available
          </td>
        </tr>
      `;
      return;
    }
    
    // Calculate pagination
    const itemsPerPage = pagination.itemsPerPage;
    const currentPage = pagination.currentPage;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, unassignedItems.length);
    const totalPages = Math.ceil(unassignedItems.length / itemsPerPage);
    
    // Update pagination state
    this.state.pagination.totalPages = totalPages;
    this.state.pagination.totalItems = unassignedItems.length;
    
    // Update page info text
    if (pageInfo) {
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Enable/disable pagination buttons
    if (prevButton) {
      prevButton.disabled = currentPage <= 1;
    }
    
    if (nextButton) {
      nextButton.disabled = currentPage >= totalPages;
    }
    
    // Get current page items
    const currentPageItems = unassignedItems.slice(startIndex, endIndex);
    
    // Render current page items
    currentPageItems.forEach(item => {
      const isSelected = selectedItems.includes(item.id);
      
      const row = document.createElement('tr');
      row.dataset.id = item.id;
      
      row.innerHTML = `
        <td class="text-center">
          <input class="form-check-input item-checkbox" type="checkbox" 
                 value="${item.id}" ${isSelected ? 'checked' : ''} 
                 id="tm-${item.id}">
        </td>
        <td><label class="form-check-label mb-0" for="tm-${item.id}">${item.title || item.name}</label></td>
        <td>${item.description || ''}</td>
      `;
      
      // Add click listener for checkbox
      const checkbox = row.querySelector('.item-checkbox');
      checkbox.addEventListener('change', e => {
        this.toggleItemSelection(item.id, e.target.checked);
      });
      
      itemList.appendChild(row);
    });
    
    // Update selected count
    this.updateSelectedCount();
  }

  /**
   * Filter items based on search text
   * 
   * @param {string} searchText - Text to search for
   */
  filterItems(searchText) {
    const itemElements = this.elements.itemList.querySelectorAll('.list-group-item');
    
    itemElements.forEach(item => {
      const text = item.textContent.toLowerCase();
      
      if (text.includes(searchText) || searchText === '') {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /**
   * Toggle selection of an item
   * 
   * @param {string} itemId - ID of the item to toggle
   * @param {boolean} selected - Whether the item is selected
   */
  toggleItemSelection(itemId, selected) {
    if (selected) {
      // Add to selected items if not already there
      if (!this.state.selectedItems.includes(itemId)) {
        this.state.selectedItems.push(itemId);
      }
    } else {
      // Remove from selected items
      this.state.selectedItems = this.state.selectedItems.filter(id => id !== itemId);
    }
    
    // Update selected count
    this.updateSelectedCount();
  }

  /**
   * Update the selected count text
   */
  updateSelectedCount() {
    const { selectedCount, selectedBadge } = this.elements;
    const { selectedItems } = this.state;
    const { labels } = this.config;
    
    // Update badge count
    if (selectedBadge) {
      selectedBadge.textContent = selectedItems.length;
    }
    
    if (selectedCount) {
      if (selectedItems.length === 0) {
        selectedCount.className = 'alert alert-primary d-flex align-items-center';
      } else {
        selectedCount.className = 'alert alert-success d-flex align-items-center';
      }
    }
  }
  
  /**
   * Go to the previous page
   */
  goToPreviousPage() {
    const { pagination } = this.state;
    
    if (pagination.currentPage > 1) {
      pagination.currentPage--;
      this.renderItems();
    }
  }
  
  /**
   * Go to the next page
   */
  goToNextPage() {
    const { pagination } = this.state;
    
    if (pagination.currentPage < pagination.totalPages) {
      pagination.currentPage++;
      this.renderItems();
    }
  }
  
  /**
   * Toggle select all items
   * @param {boolean} checked Whether to select or deselect all items
   */
  toggleSelectAll(checked) {
    const { itemList } = this.elements;
    const checkboxes = itemList.querySelectorAll('.item-checkbox');
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
      this.toggleItemSelection(checkbox.value, checked);
    });
  }

  /**
   * Assign selected items
   */
  async assignSelectedItems() {
    const { entityId, apiEndpoints, onAssignmentComplete, labels } = this.config;
    const { selectedItems } = this.state;
    const { assignButton, error } = this.elements;
    
    // Validate selection
    if (selectedItems.length === 0) {
      alert(`Please select at least one ${labels.itemNameSingular} to assign.`);
      return;
    }
    
    // Update UI for loading state
    assignButton.disabled = true;
    assignButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Assigning...`;
    
    try {
      // Make the API request to assign items
      const response = await fetch(apiEndpoints.assign, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: selectedItems })
      });
      
      if (!response.ok) {
        let errorMessage = `Server responded with status ${response.status}`;
        
        // Try to get more detailed error from response
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        
        throw new Error(errorMessage);
      }
      
      // Parse response
      const result = await response.json();
      
      // Show success message
      alert(`${result.count || selectedItems.length} ${
        (result.count || selectedItems.length) === 1 ? labels.itemNameSingular : labels.itemNamePlural
      } assigned successfully!`);
      
      // Close the modal
      this.close();
      
      // Call the onAssignmentComplete callback
      if (typeof onAssignmentComplete === 'function') {
        onAssignmentComplete();
      }
    } catch (err) {
      console.error('Error assigning items:', err);
      
      // Show error message
      error.style.display = 'block';
      error.textContent = `Error: ${err.message}`;
    } finally {
      // Reset button state
      assignButton.disabled = false;
      assignButton.innerHTML = labels.assignButtonText;
    }
  }

  /**
   * Remove an item
   * 
   * @param {string} itemId - ID of the item to remove
   * @returns {Promise<boolean>} - Whether removal was successful
   */
  async removeItem(itemId) {
    const { entityId, apiEndpoints, labels } = this.config;
    
    if (!confirm(`Are you sure you want to remove this ${labels.itemNameSingular}?`)) {
      return false;
    }
    
    try {
      // Make API request to remove item
      const response = await fetch(apiEndpoints.remove.replace(':itemId', itemId), {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      // Success
      return true;
    } catch (err) {
      console.error(`Error removing ${labels.itemNameSingular}:`, err);
      alert(`Failed to remove ${labels.itemNameSingular}: ${err.message}`);
      return false;
    }
  }
}

/**
 * Create an item assignment manager with the given configuration
 * 
 * @param {Object} config - Configuration object (see ItemAssignmentManager constructor)
 * @returns {ItemAssignmentManager} - The assignment manager instance
 */
function createItemAssignmentManager(config) {
  return new ItemAssignmentManager(config);
}

/**
 * Initialize a reusable assignment modal for the given entity and item types
 * 
 * @param {Object} config - Configuration object
 * @returns {Object} - API object with methods to control the assignment manager
 */
function initializeAssignmentModal(config) {
  // Default configuration
  const defaultConfig = {
    entityId: null,
    entityType: 'entity',
    itemType: 'item',
    modalContainerId: 'itemAssignmentModal',
    onAssignmentComplete: () => window.location.reload(),
    apiEndpoints: {
      getAssigned: `/api/${config.entityType}s/${config.entityId}/items`,
      getUnassigned: `/api/${config.entityType}s/${config.entityId}/unassigned-items`,
      assign: `/api/${config.entityType}s/${config.entityId}/items`,
      remove: `/api/${config.entityType}s/${config.entityId}/items/:itemId`,
    },
    labels: {
      modalTitle: `Assign Items`,
      assignButtonText: 'Assign Selected',
      itemNameSingular: 'item',
      itemNamePlural: 'items',
    }
  };
  
  // Merge with provided config
  const mergedConfig = {
    ...defaultConfig,
    ...config,
    apiEndpoints: {
      ...defaultConfig.apiEndpoints,
      ...(config.apiEndpoints || {})
    },
    labels: {
      ...defaultConfig.labels,
      ...(config.labels || {})
    }
  };
  
  // Create the assignment manager
  const manager = createItemAssignmentManager(mergedConfig);
  
  // Return API object
  return {
    openModal: () => manager.open(),
    closeModal: () => manager.close(),
    refresh: () => manager.loadItems(),
    removeItem: (itemId) => manager.removeItem(itemId)
  };
}

// Export for use in other modules
window.initializeAssignmentModal = initializeAssignmentModal;
