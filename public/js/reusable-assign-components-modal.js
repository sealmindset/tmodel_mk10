/**
 * Reusable Assign Components Modal
 * Matches the style and UX of Assign Threat Models modal.
 * Usage: openAssignComponentsModal({ projectId, onAssigned })
 */

(function(window) {
  function openAssignComponentsModal({ projectId, onAssigned }) {
    // Modal container
    let modalContainer = document.getElementById('componentsAssignmentsModal');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'componentsAssignmentsModal';
      document.body.appendChild(modalContainer);
    }
    modalContainer.innerHTML = '';

    // Modal HTML
    const modalHtml = `
      <div class="modal fade" id="assignComponentsModal" tabindex="-1" aria-labelledby="assignComponentsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="assignComponentsModalLabel">Assign Components</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="assignComponentsModalContent">
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading components...</p>
              </div>
            </div>
            <div class="modal-footer">
              <div class="me-auto">
                <span class="badge bg-primary" id="selectedComponentsCountBadge">0 selected</span>
              </div>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="assignSelectedComponentsBtn" disabled>Assign Selected</button>
            </div>
          </div>
        </div>
      </div>
    `;
    modalContainer.innerHTML = modalHtml;
    const modal = document.getElementById('assignComponentsModal');

    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Load components
    loadAvailableComponents(projectId);

    // Assign button
    const assignSelectedBtn = document.getElementById('assignSelectedComponentsBtn');
    if (assignSelectedBtn) {
      assignSelectedBtn.onclick = function() {
        assignSelectedComponents(projectId, () => {
          bsModal.hide();
          if (typeof onAssigned === 'function') onAssigned();
        });
      };
    }
  }

  function loadAvailableComponents(projectId) {
    const modalContent = document.getElementById('assignComponentsModalContent');
    if (!modalContent) return;
    modalContent.innerHTML = `<div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading components...</p>
    </div>`;
    fetch('/api/components')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => renderAvailableComponents(data.data || []))
      .catch(() => {
        modalContent.innerHTML = `<div class="alert alert-danger" role="alert">
          Failed to load available components. Please try again later.
        </div>`;
      });
  }

  function renderAvailableComponents(components) {
    // Pagination state
    let currentPage = 1;
    const pageSize = 10;
    let filteredComponents = [...components];

    function renderTable() {
      const modalContent = document.getElementById('assignComponentsModalContent');
      if (!modalContent) return;
      const totalPages = Math.ceil(filteredComponents.length / pageSize) || 1;
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pageItems = filteredComponents.slice(startIdx, endIdx);
      let html = `
        <input type="text" class="form-control mb-2" placeholder="Search components..." id="componentSearchInput">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="selectAllComponents">
          <label class="form-check-label" for="selectAllComponents">Select All</label>
        </div>
        <div class="table-responsive">
        <table class="table table-bordered table-hover table-sm mb-0">
          <thead class="table-light">
            <tr>
              <th style="width:40px;"></th>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
      `;
      for (const c of pageItems) {
        html += `<tr>
          <td><input class="form-check-input component-checkbox" type="checkbox" data-id="${c.id}"></td>
          <td>${c.name}</td>
          <td>${c.description || ''}</td>
        </tr>`;
      }
      if (pageItems.length === 0) {
        html += `<tr><td colspan="3" class="text-center text-muted">No components found.</td></tr>`;
      }
      html += `</tbody></table></div>`;
      // Pagination
      html += `<nav class="mt-2"><ul class="pagination pagination-sm justify-content-center mb-0">
        <li class="page-item${currentPage === 1 ? ' disabled' : ''}">
          <button class="page-link" id="prevComponentsPage">Previous</button>
        </li>
        <li class="page-item disabled"><span class="page-link">Page ${currentPage} of ${totalPages}</span></li>
        <li class="page-item${currentPage === totalPages ? ' disabled' : ''}">
          <button class="page-link" id="nextComponentsPage">Next</button>
        </li>
      </ul></nav>`;
      modalContent.innerHTML = html;
      // Select all logic
      const selectAll = document.getElementById('selectAllComponents');
      if (selectAll) {
        selectAll.onchange = function() {
          document.querySelectorAll('.component-checkbox').forEach(cb => {
            cb.checked = selectAll.checked;
          });
          updateSelectedComponentsCount();
        };
      }
      // Checkbox change
      document.querySelectorAll('.component-checkbox').forEach(cb => {
        cb.onchange = updateSelectedComponentsCount;
      });
      // Pagination events
      const prevBtn = document.getElementById('prevComponentsPage');
      const nextBtn = document.getElementById('nextComponentsPage');
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
      const searchInput = document.getElementById('componentSearchInput');
      if (searchInput) {
        searchInput.onkeydown = function(e) {
          if (e.key === 'Enter') {
            const query = searchInput.value.trim().toLowerCase();
            filteredComponents = components.filter(comp => {
              const name = (comp.name || '').toLowerCase();
              const desc = (comp.description || '').toLowerCase();
              return name.includes(query) || desc.includes(query);
            });
            currentPage = 1;
            renderTable();
          }
        };
      }
      updateSelectedComponentsCount();
    }
    renderTable();
  }

  function updateSelectedComponentsCount() {
    const count = document.querySelectorAll('.component-checkbox:checked').length;
    const badge = document.getElementById('selectedComponentsCountBadge');
    const assignBtn = document.getElementById('assignSelectedComponentsBtn');
    if (badge) badge.textContent = `${count} selected`;
    if (assignBtn) assignBtn.disabled = count === 0;
  }

  function assignSelectedComponents(projectId, onAssigned) {
    const ids = Array.from(document.querySelectorAll('.component-checkbox:checked')).map(cb => cb.getAttribute('data-id'));
    if (ids.length === 0) {
      alert('Please select at least one component to assign.');
      return;
    }
    const assignBtn = document.getElementById('assignSelectedComponentsBtn');
    if (assignBtn) {
      assignBtn.disabled = true;
      assignBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Assigning...';
    }
    fetch(`/api/projects/${projectId}/components/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentIds: ids })
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
        alert('Failed to assign components. Please try again.');
      });
  }

  window.openAssignComponentsModal = openAssignComponentsModal;
})(window);
