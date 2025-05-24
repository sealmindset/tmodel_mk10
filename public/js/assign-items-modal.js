(function(window) {
  function openAssignItemsModal({ entityId, fetchUrl, assignUrl, title, itemLabel, onAssigned }) {
    let container = document.getElementById('assignItemsModalContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'assignItemsModalContainer';
      document.body.appendChild(container);
    }
    container.innerHTML = '';
    container.innerHTML = `
      <div class="modal fade assign-modal" id="assignItemsModal" tabindex="-1" aria-labelledby="assignItemsModalLabel">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="assignItemsModalLabel">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="assignItemsModalBody">
              <div class="text-center py-4">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Loading ${itemLabel.toLowerCase()}s...</p>
              </div>
            </div>
            <div class="modal-footer">
              <span class="badge bg-primary" id="assignItemsSelectedCount">0 selected</span>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" id="assignItemsSubmitBtn" disabled>Assign Selected</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const modal = new bootstrap.Modal(document.getElementById('assignItemsModal'));
    modal.show();
    // Fetch and render items
    fetch(fetchUrl)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => renderTable(data.data || []))
      .catch(() => showError('Failed to load items. Please try again.'));
    function renderTable(items) {
      const body = document.getElementById('assignItemsModalBody');
      if (!body) return;
      if (!Array.isArray(items) || items.length === 0) {
        body.innerHTML = `<div class='alert alert-warning'>No ${itemLabel.toLowerCase()}s available.</div>`;
        return;
      }
      let html = `<input type='text' class='form-control mb-2' placeholder='Search ${itemLabel.toLowerCase()}s...' id='assignItemsSearchInput'>`;
      html += `<div class='table-responsive'><table class='table table-bordered table-hover table-sm'><thead><tr><th><input type='checkbox' id='assignItemsSelectAll'></th><th>Name</th><th>Description</th></tr></thead><tbody>`;
      for (const item of items) {
        html += `<tr><td><input class='form-check-input assign-item-checkbox' type='checkbox' value='${item.id}' data-id='${item.id}'></td><td><strong>${item.name}</strong></td><td><span class='text-muted small'>${item.description || ''}</span></td></tr>`;
      }
      html += `</tbody></table></div>`;
      body.innerHTML = html;
      // Selection
      const checkboxes = body.querySelectorAll('.assign-item-checkbox');
      const selectAll = body.querySelector('#assignItemsSelectAll');
      const badge = document.getElementById('assignItemsSelectedCount');
      const submitBtn = document.getElementById('assignItemsSubmitBtn');
      function updateCount() {
        const count = body.querySelectorAll('.assign-item-checkbox:checked').length;
        badge.textContent = `${count} selected`;
        submitBtn.disabled = count === 0;
        if (selectAll) selectAll.checked = count === checkboxes.length;
      }
      checkboxes.forEach(cb => cb.onchange = updateCount);
      if (selectAll) {
        selectAll.onchange = function() {
          checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
          updateCount();
        };
      }
      updateCount();
      // Search
      const searchInput = body.querySelector('#assignItemsSearchInput');
      if (searchInput) {
        searchInput.oninput = function() {
          const query = searchInput.value.trim().toLowerCase();
          const filtered = items.filter(it => (it.name || '').toLowerCase().includes(query) || (it.description || '').toLowerCase().includes(query));
          renderTable(filtered);
        };
      }
    }
    function showError(msg) {
      const body = document.getElementById('assignItemsModalBody');
      if (body) body.innerHTML = `<div class='alert alert-danger'>${msg}</div>`;
    }
    document.getElementById('assignItemsSubmitBtn').onclick = function() {
      const checked = Array.from(document.querySelectorAll('.assign-item-checkbox:checked')).map(cb => cb.getAttribute('data-id'));
      if (!checked.length) return;
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Assigning...';
      fetch(assignUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentIds: checked })
      })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then(() => {
          btn.disabled = false;
          btn.innerHTML = 'Assign Selected';
          modal.hide();
          if (typeof onAssigned === 'function') onAssigned();
        })
        .catch(() => {
          btn.disabled = false;
          btn.innerHTML = 'Assign Selected';
          showError('Failed to assign items. Please try again.');
        });
    };
  }
  window.openAssignItemsModal = openAssignItemsModal;
})(window);
