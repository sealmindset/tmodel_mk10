// LLM Usage Meter DataTables + Modal logic
$(document).ready(function() {
  const table = $('#llm-usage-table').DataTable({
    ajax: {
      url: '/api/llm-usage',
      dataSrc: 'data',
    },
    columns: [
      { data: 'timestamp', render: data => data ? new Date(data).toLocaleString() : '' },
      { data: 'task_type' },
      { data: 'model_provider' },
      { data: 'model_name' },
      { data: 'tokens_prompt' },
      { data: 'tokens_completion' },
      { data: 'tokens_total' },
      { data: 'cost_usd', render: data => data == null ? '' : `$${parseFloat(data).toFixed(6)}` },
      { data: 'session_id', render: data => data ? `<span class='text-monospace small'>${data}</span>` : '' },
      { data: 'id', render: data => `<a href="#" class="event-id-link text-monospace" data-id="${data}">${data}</a>` }
    ],
    order: [[0, 'desc']],
    responsive: true,
    pageLength: 25,
    dom: 'Bfrtip',
    buttons: [
      'copy', 'csv', 'excel', 'pdf', 'print'
    ],
    language: {
      emptyTable: 'No LLM usage events found.'
    }
  });

  // Event handler for row click (event id link)
  $('#llm-usage-table tbody').on('click', 'a.event-id-link', function(e) {
    e.preventDefault();
    const id = $(this).data('id');
    showUsageDetailModal(id);
  });

  function showUsageDetailModal(id) {
    $('#usage-detail-loading').show();
    $('#usage-detail-content').hide();
    $('#usage-detail-error').addClass('d-none').text('');
    $('#usageDetailModal').modal('show');
    $.ajax({
      url: `/api/llm-usage/${id}`,
      method: 'GET',
      success: function(data) {
        $('#usage-detail-loading').hide();
        if (data && data.success && data.usage) {
          const usage = data.usage;
          $('#detail-timestamp').text(usage.timestamp ? new Date(usage.timestamp).toLocaleString() : '');
          $('#detail-task-type').text(usage.task_type || '');
          $('#detail-provider').text(usage.model_provider || '');
          $('#detail-model').text(usage.model_name || '');
          $('#detail-session-id').text(usage.session_id || '');
          $('#detail-tokens').text(
            [usage.tokens_prompt, usage.tokens_completion, usage.tokens_total].map(x => x == null ? '' : x).join(' / ')
          );
          $('#detail-cost').text(usage.cost_usd == null ? '' : `$${parseFloat(usage.cost_usd).toFixed(6)}`);
          $('#detail-prompt').text(usage.prompt || '');
          $('#detail-response').text(usage.response || '');
          $('#detail-meta').text(
            usage.meta ? JSON.stringify(usage.meta, null, 2) : ''
          );
          $('#usage-detail-content').show();
        } else {
          $('#usage-detail-error').removeClass('d-none').text('Failed to load details.');
        }
      },
      error: function(xhr, status, err) {
        $('#usage-detail-loading').hide();
        $('#usage-detail-error').removeClass('d-none').text('Error loading details: ' + (xhr.responseText || err));
      }
    });
  }
});
