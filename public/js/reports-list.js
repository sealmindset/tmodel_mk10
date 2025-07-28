/**
 * Reports List Page Script
 * Populates DataTables with projects and existing reports
 */

document.addEventListener('DOMContentLoaded', () => {
  initProjectsTable();
});

async function initProjectsTable() {
  // Avoid DataTables reinitialisation error
  if ($.fn.DataTable.isDataTable('#projects-table')) {
    $('#projects-table').DataTable().clear().destroy();
  }
  const table = $('#projects-table').DataTable({
    columns: [
      { data: 'name' },
      { data: 'description' },
      { data: 'generateBtn', orderable: false },
      { data: 'viewBtn', orderable: false }
    ]
  });

  try {
    const resp = await fetch('/api/projects');
    let projectsJson = await resp.json();
    let projects = Array.isArray(projectsJson) ? projectsJson : (projectsJson.data || []);

    projects.forEach(p => {
      table.row.add({
        name: p.name,
        description: p.description || '',
        generateBtn: `<button class="btn btn-sm btn-primary" data-action="generate" data-project="${p.id}"><i class="fas fa-cogs"></i> Generate</button>`,
        viewBtn: `<button class="btn btn-sm btn-secondary" data-action="view" data-project="${p.id}" disabled><i class="fas fa-eye"></i> View</button>`,
        _projectId: p.id,
        _uuid: p.id
      });
    });
    table.draw();

    // After draw add buttons
    $('#projects-table tbody').off('click').on('click', 'button', function() {
      const rowData = table.row($(this).closest('tr')).data();
      const action = this.dataset.action;
      if (action === 'generate') {
        window.location.href = `/reports/new/${rowData._uuid}`;
      } else if (action === 'view') {
        window.location.href = `/reports/view/${rowData._latestReportId}`;
      }
    });

  } catch (e) {
    console.error('Failed loading projects', e);
    alert('Error loading projects');
  }
}
