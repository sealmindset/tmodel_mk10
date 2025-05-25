# Reusable Assignment Module Usage Guide

This guide demonstrates how to implement a new assignment feature (like "Assign Vulnerabilities") using our reusable templates. By following these patterns, you'll maintain consistency and avoid the issues we encountered with earlier implementations.

## Step 1: Set up the Service Layer

First, create a new service file or adapt the template for your specific use case:

```javascript
// services/vulnerabilityAssignmentService.js
const itemAssignmentTemplate = require('./itemAssignmentTemplate');

// Configuration for vulnerability assignments
const config = {
  schema: 'threat_model',
  itemsTable: 'vulnerabilities',
  entityField: 'component_id'  // Field in vulnerabilities table
};

/**
 * Get vulnerabilities assigned to a component
 */
async function getVulnerabilitiesForComponent(componentId) {
  return itemAssignmentTemplate.getItemsForEntity(componentId, {
    ...config
  });
}

/**
 * Get vulnerabilities not assigned to a component
 */
async function getUnassignedVulnerabilitiesForComponent(componentId) {
  return itemAssignmentTemplate.getUnassignedItemsForEntity(componentId, {
    ...config
  });
}

/**
 * Assign vulnerabilities to a component
 */
async function assignVulnerabilitiesToComponent(componentId, vulnerabilityIds) {
  return itemAssignmentTemplate.assignItemsToEntityWithLogging(componentId, vulnerabilityIds, {
    ...config
  });
}

/**
 * Remove a vulnerability from a component
 */
async function removeVulnerabilityFromComponent(componentId, vulnerabilityId) {
  return itemAssignmentTemplate.removeItemFromEntity(componentId, vulnerabilityId, {
    ...config
  });
}

module.exports = {
  getVulnerabilitiesForComponent,
  getUnassignedVulnerabilitiesForComponent,
  assignVulnerabilitiesToComponent,
  removeVulnerabilityFromComponent
};
```

## Step 2: Create the API Routes

Add API endpoints to connect the frontend with the service layer:

```javascript
// routes/api/components.js
const express = require('express');
const router = express.Router();
const vulnerabilityService = require('../../services/vulnerabilityAssignmentService');

// Get vulnerabilities for a component
router.get('/:id/vulnerabilities', async (req, res) => {
  try {
    const vulnerabilities = await vulnerabilityService.getVulnerabilitiesForComponent(req.params.id);
    res.json(vulnerabilities);
  } catch (err) {
    console.error('Error fetching vulnerabilities:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerabilities' });
  }
});

// Get unassigned vulnerabilities for a component
router.get('/:id/unassigned-vulnerabilities', async (req, res) => {
  try {
    const vulnerabilities = await vulnerabilityService.getUnassignedVulnerabilitiesForComponent(req.params.id);
    res.json(vulnerabilities);
  } catch (err) {
    console.error('Error fetching unassigned vulnerabilities:', err);
    res.status(500).json({ error: 'Failed to fetch unassigned vulnerabilities' });
  }
});

// Assign vulnerabilities to a component
router.post('/:id/vulnerabilities', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No vulnerability IDs provided' });
    }
    
    const result = await vulnerabilityService.assignVulnerabilitiesToComponent(req.params.id, ids);
    
    if (result.success) {
      res.json({ success: true, count: result.count, ids: result.ids });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (err) {
    console.error('Error assigning vulnerabilities:', err);
    res.status(500).json({ error: 'Failed to assign vulnerabilities' });
  }
});

// Remove a vulnerability from a component
router.delete('/:id/vulnerabilities/:vulnId', async (req, res) => {
  try {
    const result = await vulnerabilityService.removeVulnerabilityFromComponent(
      req.params.id, 
      req.params.vulnId
    );
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (err) {
    console.error('Error removing vulnerability:', err);
    res.status(500).json({ error: 'Failed to remove vulnerability' });
  }
});

module.exports = router;
```

## Step 3: Add the Modal to the View

Include the reusable assignment modal in your component detail page:

```html
<!-- views/component-detail.ejs -->

<!-- Your existing content -->

<!-- Add this where you want the modal to be initialized -->
<div id="vulnerabilityAssignmentModalContainer"></div>

<!-- Include the reusable assignment script -->
<script src="/js/reusable-item-assignment.js"></script>

<!-- Initialize the vulnerability assignment functionality -->
<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Button to open the assignment modal
    const assignVulnerabilitiesBtn = document.getElementById('assignVulnerabilitiesBtn');
    if (assignVulnerabilitiesBtn) {
      assignVulnerabilitiesBtn.addEventListener('click', function() {
        // Initialize the modal if it doesn't exist
        if (!document.querySelector('#vulnerabilityAssignmentModal')) {
          const modalContainer = document.getElementById('vulnerabilityAssignmentModalContainer');
          modalContainer.innerHTML = `<%- include('partials/reusable-assignment-modal', {
            id: 'vulnerabilityAssignmentModal',
            title: 'Assign Vulnerabilities',
            entityType: 'component',
            entityId: component.id,
            itemType: 'vulnerability',
            itemTypeSingular: 'vulnerability',
            itemTypePlural: 'vulnerabilities',
            assignButtonText: 'Assign Selected Vulnerabilities',
            noScript: true // We'll initialize it manually
          }) %>`;
        }

        // Initialize and open the modal
        const manager = initializeAssignmentModal({
          entityId: '<%= component.id %>',
          entityType: 'component',
          itemType: 'vulnerability',
          modalContainerId: 'vulnerabilityAssignmentModalContainer',
          labels: {
            modalTitle: 'Assign Vulnerabilities',
            assignButtonText: 'Assign Selected Vulnerabilities',
            itemNameSingular: 'vulnerability',
            itemNamePlural: 'vulnerabilities'
          },
          onAssignmentComplete: function() {
            // Custom handler that refreshes the vulnerabilities section
            fetchVulnerabilities('<%= component.id %>');
          }
        });
        
        // Open the modal
        manager.openModal();
      });
    }
    
    // Function to refresh vulnerabilities section
    function fetchVulnerabilities(componentId) {
      const container = document.getElementById('vulnerabilitiesContainer');
      if (!container) return;
      
      // Show loading state
      container.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div></div>';
      
      // Fetch updated data
      fetch(`/api/components/${componentId}/vulnerabilities`)
        .then(response => response.json())
        .then(data => {
          // Render the vulnerabilities
          renderVulnerabilities(data, container);
        })
        .catch(error => {
          console.error('Error fetching vulnerabilities:', error);
          container.innerHTML = '<div class="alert alert-danger">Failed to load vulnerabilities</div>';
        });
    }
    
    // Function to render vulnerabilities in the container
    function renderVulnerabilities(vulnerabilities, container) {
      if (!vulnerabilities || vulnerabilities.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No vulnerabilities assigned to this component.</div>';
        return;
      }
      
      // Render vulnerabilities
      let html = '<div class="list-group">';
      vulnerabilities.forEach(vuln => {
        html += `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-1">${vuln.title}</h5>
              <span class="badge bg-${getSeverityClass(vuln.severity)}">${vuln.severity}</span>
            </div>
            <p class="mb-1">${vuln.description || 'No description provided'}</p>
            <button class="btn btn-sm btn-outline-danger remove-vuln-btn" 
                    data-vuln-id="${vuln.id}">
              <i class="bi bi-x-circle"></i> Remove
            </button>
          </div>
        `;
      });
      html += '</div>';
      
      // Set the HTML content
      container.innerHTML = html;
      
      // Add event listeners for remove buttons
      container.querySelectorAll('.remove-vuln-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const vulnId = this.getAttribute('data-vuln-id');
          removeVulnerability(vulnId);
        });
      });
    }
    
    // Function to remove a vulnerability
    function removeVulnerability(vulnId) {
      if (confirm('Are you sure you want to remove this vulnerability?')) {
        fetch(`/api/components/<%= component.id %>/vulnerabilities/${vulnId}`, {
          method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Refresh the list
            fetchVulnerabilities('<%= component.id %>');
          } else {
            alert('Failed to remove vulnerability: ' + (data.error || 'Unknown error'));
          }
        })
        .catch(error => {
          console.error('Error removing vulnerability:', error);
          alert('Failed to remove vulnerability: ' + error.message);
        });
      }
    }
    
    // Helper function for severity badge colors
    function getSeverityClass(severity) {
      switch (severity.toLowerCase()) {
        case 'critical': return 'danger';
        case 'high': return 'warning';
        case 'medium': return 'primary';
        case 'low': return 'success';
        default: return 'secondary';
      }
    }
  });
</script>
```

## Step 4: Add the UI Button

Add a button to the component detail page to trigger the modal:

```html
<!-- In the component detail page header -->
<div class="btn-group">
  <button class="btn btn-outline-primary" id="assignVulnerabilitiesBtn">
    <i class="bi bi-shield-exclamation me-1"></i>Assign Vulnerabilities
  </button>
</div>
```

## Benefits of This Approach

By using this template:

1. **Consistency**: All assignment functionality follows the same pattern
2. **Error Prevention**: Proper parameter validation and error handling
3. **Transaction Safety**: Database operations are wrapped in transactions
4. **UX Improvements**: Loading states and clear feedback to users
5. **DRY Code**: No duplication across different assignment features
6. **Flexibility**: Easy to customize for different entity and item types

## Important Validation Checks

The template includes multiple levels of validation:

1. **Service Layer**:
   - Checks for empty arrays
   - Validates item existence before assignment
   - Uses transactions for data integrity
   - Detailed logging for troubleshooting

2. **API Layer**:
   - Validates request data
   - Returns proper HTTP status codes
   - Consistent error message format

3. **UI Layer**:
   - Validates user selections
   - Provides clear feedback
   - Handles loading and error states properly

## Debugging Tips

If you encounter issues:

1. Check the browser console for errors
2. Look at the server logs for detailed messages
3. Verify the API endpoints are correctly configured
4. Ensure the database schema matches what's expected
5. Test API endpoints directly before troubleshooting the UI

## Real-World Testing

Before deploying, test these edge cases:

1. Assigning zero items (should show validation message)
2. Assigning invalid items (should be handled gracefully)
3. Network failures during assignment
4. Database constraint violations
5. Concurrent assignments from multiple users

By following this approach and thorough testing, you'll avoid the issues encountered with previous assignment implementations.
