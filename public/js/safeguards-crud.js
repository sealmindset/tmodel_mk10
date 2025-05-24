// JS for Safeguards DataTable and CRUD actions
$(document).ready(function() {
  const table = $('#safeguards-table').DataTable({
    responsive: true,
    order: [[1, 'asc']],
    columnDefs: [
      { orderable: false, targets: [0, 6] },
      { className: 'dt-center', targets: [0, 4, 6] }
    ]
  });

  // Select/Deselect all
  $('#selectAllSafeguardsCheckbox').on('click', function() {
    const checked = this.checked;
    $('.row-checkbox').each(function() {
      this.checked = checked;
    });
    $('#deleteSelectedSafeguardsBtn').prop('disabled', !checked);
  });

  // Row checkbox toggle
  $(document).on('change', '.row-checkbox', function() {
    const total = $('.row-checkbox').length;
    const checked = $('.row-checkbox:checked').length;
    $('#selectAllSafeguardsCheckbox').prop('checked', total === checked);
    $('#deleteSelectedSafeguardsBtn').prop('disabled', checked === 0);
  });

  // Refresh button
  $('#refreshSafeguards').on('click', function() {
    location.reload();
  });

  // Delete selected
  $('#deleteSelectedSafeguardsBtn').on('click', function() {
    const ids = $('.row-checkbox:checked').map(function() { return this.value; }).get();
    if (ids.length === 0) return;
    if (!confirm('Delete selected safeguards?')) return;
    $.ajax({
      url: '/api/safeguards/bulk-delete',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ ids }),
      success: function() { location.reload(); },
      error: function() { showToast('Bulk delete failed', 'danger'); }
    });
  });

  // Delete single safeguard
  $(document).on('click', '.delete-safeguard-btn', function() {
    const id = $(this).data('id');
    if (!confirm('Delete this safeguard?')) return;
    $.ajax({
      url: '/api/safeguards/' + id,
      method: 'DELETE',
      success: function() { location.reload(); },
      error: function() { showToast('Delete failed', 'danger'); }
    });
  });

  // Select All / Deselect All
  $('#selectAllSafeguardsBtn').on('click', function() {
    $('.row-checkbox').prop('checked', true).trigger('change');
  });
  $('#deselectAllSafeguardsBtn').on('click', function() {
    $('.row-checkbox').prop('checked', false).trigger('change');
  });

  // Export Selected
  $('#exportSelectedSafeguardsBtn').on('click', function() {
    const ids = $('.row-checkbox:checked').map(function() { return this.value; }).get();
    if (ids.length === 0) return showToast('No safeguards selected', 'warning');
    window.location = '/api/safeguards/export?ids=' + ids.join(',');
  });

  function showToast(message, type) {
    const toast = $(
      `<div class="toast align-items-center text-bg-${type} border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
      </div>`
    );
    $('#toastContainer').append(toast);
    toast.toast({ delay: 3000 });
    toast.toast('show');
    toast.on('hidden.bs.toast', function() { $(this).remove(); });
  }
});
