(function(window) {
  // Reusable Assign Safeguards Modal
  function openAssignSafeguardsModal({ componentId, onAssigned }) {
    // Remove any existing Bootstrap modal backdrops
    document.querySelectorAll('.modal-backdrop').forEach(el => el.parentNode.removeChild(el));
    // Remove any existing modal with the same ID from the DOM before injecting new HTML
    const existingModal = document.getElementById('assignSafeguardsModal');
    if (existingModal && existingModal.parentNode) {
      // Hide and dispose any existing Bootstrap modal instance
      try {
        const inst = bootstrap.Modal.getInstance(existingModal);
        if (inst) { inst.hide(); inst.dispose(); }
      } catch (e) {}
      existingModal.parentNode.removeChild(existingModal);
    }
    // Remove any existing modal container
    let modalContainer = document.getElementById('safeguardsAssignmentsModal');
    if (modalContainer && modalContainer.parentNode) {
      modalContainer.parentNode.removeChild(modalContainer);
    }
    // Create a new container
    modalContainer = document.createElement('div');
    modalContainer.id = 'safeguardsAssignmentsModal';
    document.body.appendChild(modalContainer);
    modalContainer.innerHTML = '';

    const modalHtml = `
      <div class="modal fade" id="assignSafeguardsModal" tabindex="-1" aria-labelledby="assignSafeguardsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="assignSafeguardsModalLabel">Assign Safeguards</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="assignSafeguardsModalContent">
              <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading safeguards...</p>
              </div>
            </div>
            <div class="modal-footer">
              <span id="selectedSafeguardsCountBadge" class="badge bg-secondary">0 selected</span>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="assignSelectedSafeguardsBtn" disabled>Assign Selected</button>
            </div>
          </div>
        </div>
      </div>
    `;
    modalContainer.innerHTML = modalHtml;
    // Wait for the next animation frame to ensure the modal is fully rendered
    requestAnimationFrame(() => {
      const modal = document.getElementById('assignSafeguardsModal');
      console.log('[DEBUG] assignSafeguardsModal element:', modal);
      let bsModal = null;
      if (!modal) {
        console.error('[ERROR] assignSafeguardsModal not found in DOM, aborting show.');
        return;
      }
      // Defensive: check for existing instance and dispose if needed
      try {
        bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
          // If the instance exists but is broken (disposed), dispose and create a new one
          if (!modal._isShown && typeof bsModal.show === 'function') {
            // Instance seems healthy, reuse
          } else {
            bsModal.dispose();
            bsModal = null;
          }
        }
      } catch (e) {
        console.warn('[WARN] Error getting Bootstrap modal instance:', e);
        bsModal = null;
      }
      if (!bsModal) {
        bsModal = new bootstrap.Modal(modal);
      }
      console.log('[DEBUG] assignSafeguardsModal Bootstrap instance:', bsModal);
      try {
        bsModal.show();
        // When the modal is hidden, remove the container from the DOM
        modal.addEventListener('hidden.bs.modal', function cleanup() {
          if (modalContainer && modalContainer.parentNode) {
            modalContainer.parentNode.removeChild(modalContainer);
          }
          modal.removeEventListener('hidden.bs.modal', cleanup);
        });
      } catch (e) {
        console.error('[ERROR] Exception during bsModal.show():', e);
      }
    });
    loadAvailableSafeguards(componentId);
    const assignSelectedBtn = document.getElementById('assignSelectedSafeguardsBtn');
    if (assignSelectedBtn) {
      assignSelectedBtn.onclick = function() {
        assignSelectedSafeguards(componentId, () => {
          const modal = document.getElementById('assignSafeguardsModal');
          const bsModal = modal ? bootstrap.Modal.getInstance(modal) : null;
          if (bsModal) bsModal.hide();
          if (typeof onAssigned === 'function') onAssigned();
        });
      };
    }
  }

  function loadAvailableSafeguards(componentId) {
    const modalContent = document.getElementById('assignSafeguardsModalContent');
    if (!modalContent) return;
    modalContent.innerHTML = `<div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading safeguards...</p>
    </div>`;
    fetch('/api/safeguards')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => renderAvailableSafeguards(data.data || []))
      .catch(() => {
        modalContent.innerHTML = `<div class="alert alert-danger" role="alert">
          Failed to load available safeguards. Please try again later.
        </div>`;
      });
  }

  function renderAvailableSafeguards(safeguards) {
    let currentPage = 1;
    const pageSize = 10;
    let filteredSafeguards = [...safeguards];
    function renderTable() {
      const modalContent = document.getElementById('assignSafeguardsModalContent');
      if (!modalContent) return;
      const totalPages = Math.ceil(filteredSafeguards.length / pageSize) || 1;
      const startIdx = (currentPage - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pageItems = filteredSafeguards.slice(startIdx, endIdx);
      let html = `
        <input type="text" class="form-control mb-2" placeholder="Search safeguards..." id="safeguardSearchInput">
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="selectAllSafeguards">
          <label class="form-check-label" for="selectAllSafeguards">Select All</label>
        </div>
        <div class="table-responsive mb-2">
          <table class="table table-sm table-hover">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Description</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
      `;
      pageItems.forEach(sg => {
        html += `
          <tr>
            <td><input type="checkbox" class="safeguard-checkbox" data-id="${sg.id}"></td>
            <td>${sg.name}</td>
            <td>${sg.description || ''}</td>
            <td>${sg.type || ''}</td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
      html += `<nav><ul class="pagination justify-content-center mb-0">`;
      html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}"><button class="page-link" id="prevSafeguardsPage">Previous</button></li>`;
      html += `<li class="page-item disabled"><span class="page-link">Page ${currentPage} of ${totalPages}</span></li>`;
      html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}"><button class="page-link" id="nextSafeguardsPage">Next</button></li>`;
      html += `</ul></nav>`;
      modalContent.innerHTML = html;
      // Pagination
      document.getElementById('prevSafeguardsPage').onclick = function() {
        if (currentPage > 1) { currentPage--; renderTable(); }
      };
      document.getElementById('nextSafeguardsPage').onclick = function() {
        if (currentPage < totalPages) { currentPage++; renderTable(); }
      };
      // Select All
      const selectAll = document.getElementById('selectAllSafeguards');
      selectAll.checked = false;
      selectAll.onclick = function() {
        document.querySelectorAll('.safeguard-checkbox').forEach(cb => { cb.checked = selectAll.checked; });
        updateSelectedSafeguardsCount();
      };
      // Checkbox listeners
      document.querySelectorAll('.safeguard-checkbox').forEach(cb => {
        cb.onchange = updateSelectedSafeguardsCount;
      });
      // Search
      const searchInput = document.getElementById('safeguardSearchInput');
      if (searchInput) {
        searchInput.onkeydown = function(e) {
          if (e.key === 'Enter') {
            const query = searchInput.value.trim().toLowerCase();
            filteredSafeguards = safeguards.filter(sg => {
              const name = (sg.name || '').toLowerCase();
              const desc = (sg.description || '').toLowerCase();
              return name.includes(query) || desc.includes(query);
            });
            currentPage = 1;
            renderTable();
          }
        };
      }
      updateSelectedSafeguardsCount();
    }
    renderTable();
  }

  function updateSelectedSafeguardsCount() {
    const count = document.querySelectorAll('.safeguard-checkbox:checked').length;
    const badge = document.getElementById('selectedSafeguardsCountBadge');
    const assignBtn = document.getElementById('assignSelectedSafeguardsBtn');
    if (badge) badge.textContent = `${count} selected`;
    if (assignBtn) assignBtn.disabled = count === 0;
  }

  function assignSelectedSafeguards(componentId, onAssigned) {
    const ids = Array.from(document.querySelectorAll('.safeguard-checkbox:checked')).map(cb => cb.getAttribute('data-id'));
    if (ids.length === 0) {
      alert('Please select at least one safeguard to assign.');
      return;
    }
    const assignBtn = document.getElementById('assignSelectedSafeguardsBtn');
    if (assignBtn) {
      assignBtn.disabled = true;
      assignBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Assigning...';
    }
    fetch(`/api/components/${componentId}/safeguards/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safeguardIds: ids })
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
        alert('Failed to assign safeguards. Please try again.');
      });
  }

  window.openAssignSafeguardsModal = openAssignSafeguardsModal;
})(window);
