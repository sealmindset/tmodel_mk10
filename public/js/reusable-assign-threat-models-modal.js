/**
 * Reusable Assign Threat Models Modal
 * Supports both projects and components by parameterizing context and endpoints.
 */

console.log('[DEBUG] reusable-assign-threat-models-modal.js loaded');
(function(window) {
  console.log('[DEBUG] reusable-assign-threat-models-modal.js IIFE executing');
  function openAssignThreatModelsModal({
    contextType, // 'project' or 'component'
    contextId,
    onAssigned // callback after successful assignment
  }) {
    // Modal container
    let modalContainer = document.getElementById('threatModelAssignmentsModal');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'threatModelAssignmentsModal';
      document.body.appendChild(modalContainer);
    }
    modalContainer.innerHTML = '';

    // Modal HTML
    const modalHtml = `
      <div class="modal fade" id="assignThreatModelsModal" tabindex="-1" aria-labelledby="assignThreatModelsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="assignThreatModelsModalLabel">Assign Threat Models</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="assignModalContent">
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading threat models...</p>
              </div>
            </div>
            <div class="modal-footer">
              <div class="me-auto">
                <span class="badge bg-primary" id="selectedCountBadge">0 selected</span>
              </div>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="assignSelectedBtn" disabled>Assign Selected</button>
            </div>
          </div>
        </div>
      </div>
    `;
    modalContainer.innerHTML = modalHtml;
    const modal = document.getElementById('assignThreatModelsModal');

    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Load threat models
    loadAvailableThreatModels(contextType, contextId);

    // Assign button
    const assignSelectedBtn = document.getElementById('assignSelectedBtn');
    if (assignSelectedBtn) {
      assignSelectedBtn.onclick = function() {
        assignSelectedThreatModels(contextType, contextId, () => {
          bsModal.hide();
          if (typeof onAssigned === 'function') onAssigned();
        });
      };
    }
  }

  function loadAvailableThreatModels(contextType, contextId) {
    const modalContent = document.getElementById('assignModalContent');
    if (!modalContent) return;
    modalContent.innerHTML = `<div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading threat models...</p>
    </div>`;
    const endpoint = contextType === 'component'
      ? `/api/components/${contextId}/unassigned-threat-models`
      : `/api/projects/${contextId}/unassigned-threat-models`;
    fetch(endpoint)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => renderAvailableThreatModels(data.data || []))
      .catch(() => {
        modalContent.innerHTML = `<div class="alert alert-danger" role="alert">
          Failed to load available threat models. Please try again later.
        </div>`;
      });
  }

  function renderAvailableThreatModels(threatModels) {
    // Pagination state
    let currentPage = 1;
    const pageSize = 10;
    let filteredThreatModels = [...threatModels];

    // Helper to render the table for the current page
    function renderTable() {
      const modalContent = document.getElementById('assignModalContent');
      if (!modalContent) return;
      if (!filteredThreatModels || filteredThreatModels.length === 0) {
        modalContent.innerHTML = `<div class="alert alert-info" role="alert">
          No threat models available for assignment.
        </div>`;
        return;
      }
      // Pagination math
      const totalPages = Math.ceil(filteredThreatModels.length / pageSize);
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = Math.min(filteredThreatModels.length, startIdx + pageSize);
      let html = `<div class="mb-3">
        <input id="threatModelSearchInput" class="form-control mb-2" type="text" placeholder="Search by title or description... (press Enter to search)">
        <table class="table table-striped table-hover align-middle" id="availableThreatModelsTable">
          <thead class="table-light">
            <tr>
              <th style="width:40px" class="text-center">
                <input class="form-check-input" type="checkbox" id="selectAllThreatModels">
              </th>
              <th>Title</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody id="availableThreatModelsList">
      `;
      for (let i = startIdx; i < endIdx; i++) {
        const tm = filteredThreatModels[i];
        const id = tm.id || tm._id || '';
        const title = tm.title || tm.name || 'Untitled Threat Model';
        const description = tm.description || '';
        html += `<tr>
          <td class="text-center">
            <input class="form-check-input threat-model-checkbox" type="checkbox" id="tm-${id}" data-id="${id}">
          </td>
          <td><label class="form-check-label mb-0" for="tm-${id}">${title}</label></td>
          <td>${description}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
      // Pagination controls
      html += `<nav><ul class="pagination justify-content-center">
        <li class="page-item${currentPage === 1 ? ' disabled' : ''}">
          <button class="page-link" id="prevThreatModelsPage">Previous</button>
        </li>
        <li class="page-item disabled"><span class="page-link">Page ${currentPage} of ${totalPages}</span></li>
        <li class="page-item${currentPage === totalPages ? ' disabled' : ''}">
          <button class="page-link" id="nextThreatModelsPage">Next</button>
        </li>
      </ul></nav></div>`;
      modalContent.innerHTML = html;
      // Select all logic
      const selectAll = document.getElementById('selectAllThreatModels');
      if (selectAll) {
        selectAll.onchange = function() {
          document.querySelectorAll('.threat-model-checkbox').forEach(cb => {
            cb.checked = selectAll.checked;
          });
          updateSelectedCount();
        };
      }
      // Checkbox change
      document.querySelectorAll('.threat-model-checkbox').forEach(cb => {
        cb.onchange = updateSelectedCount;
      });
      // Pagination events
      const prevBtn = document.getElementById('prevThreatModelsPage');
      const nextBtn = document.getElementById('nextThreatModelsPage');
      if (prevBtn) prevBtn.onclick = function() {
        if (currentPage > 1) {
          currentPage--;
          renderTable();
        }
      };
      if (nextBtn) nextBtn.onclick = function() {
        if (currentPage < totalPages) {
          currentPage++;
          renderTable();
        }
      };
      // Search
      const searchInput = document.getElementById('threatModelSearchInput');
      if (searchInput) {
        searchInput.onkeydown = function(e) {
          if (e.key === 'Enter') {
            const query = searchInput.value.trim().toLowerCase();
            filteredThreatModels = threatModels.filter(tm => {
              const title = (tm.title || tm.name || '').toLowerCase();
              const desc = (tm.description || '').toLowerCase();
              return title.includes(query) || desc.includes(query);
            });
            currentPage = 1;
            renderTable();
          }
        };
      }
      updateSelectedCount();
    }
    // Initial render
    renderTable();
  }

  function updateSelectedCount() {
    const count = document.querySelectorAll('.threat-model-checkbox:checked').length;
    const badge = document.getElementById('selectedCountBadge');
    const assignBtn = document.getElementById('assignSelectedBtn');
    if (badge) badge.textContent = `${count} selected`;
    if (assignBtn) assignBtn.disabled = count === 0;
  }

  function assignSelectedThreatModels(contextType, contextId, onAssigned) {
    const ids = Array.from(document.querySelectorAll('.threat-model-checkbox:checked')).map(cb => cb.getAttribute('data-id'));
    if (ids.length === 0) {
      alert('Please select at least one threat model to assign.');
      return;
    }
    const assignBtn = document.getElementById('assignSelectedBtn');
    if (assignBtn) {
      assignBtn.disabled = true;
      assignBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Assigning...';
    }
    const endpoint = contextType === 'component'
      ? `/api/components/${contextId}/threat-models`
      : `/api/projects/${contextId}/threat-models`;
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatModelIds: ids })
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(() => {
        if (assignBtn) {
          assignBtn.disabled = false;
          assignBtn.innerHTML = 'Assign Selected';
        }
        if (typeof onAssigned === 'function') onAssigned();
      })
      .catch(() => {
        if (assignBtn) {
          assignBtn.disabled = false;
          assignBtn.innerHTML = 'Assign Selected';
        }
        alert('Failed to assign threat models. Please try again.');
      });
  }

  // Expose globally
  window.openAssignThreatModelsModal = openAssignThreatModelsModal;
})(window);
