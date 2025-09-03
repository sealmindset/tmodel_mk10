/* Report Templates Manager - matches Prompt Templates UX */
(function() {
  const apiBaseEl = document.getElementById('apiBase');
  const tableBody = document.querySelector('#report-templates-table tbody');
  const emptyState = document.getElementById('emptyState');

  const btnCreate = document.getElementById('createReportTemplateBtn');
  const btnRefresh = document.getElementById('refreshReportTemplates');
  const btnDeleteSelected = document.getElementById('deleteSelectedBtn');
  const btnSelectAll = document.getElementById('selectAllBtn');
  const btnDeselectAll = document.getElementById('deselectAllBtn');
  const btnExport = document.getElementById('exportSelectedBtn');
  const chkSelectAll = document.getElementById('selectAll');
  const searchInput = document.getElementById('searchReportTemplates');
  const searchBtn = document.getElementById('searchButton');

  let templates = [];

  function apiBase() {
    return (apiBaseEl && apiBaseEl.value) || 'http://localhost:3002';
  }

  function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const id = 'toast-' + Date.now();
    const html = `
      <div id="${id}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header bg-${type} text-white">
          <strong class="me-auto">${title}</strong>
          <small>Just now</small>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">${message}</div>
      </div>`;
    container.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    const toast = new bootstrap.Toast(el, { delay: 4000 });
    toast.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  }

  async function fetchTemplates() {
    const base = apiBase().replace(/\/$/, '');
    try {
      const res = await fetch(`${base}/reports.report_templates?order=name.asc`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      templates = Array.isArray(data) ? data : [];
      renderRows(templates);
    } catch (lastErr) {
      console.error('Failed to fetch report templates', lastErr);
      showToast('Error', `Failed to load report templates: ${(lastErr && lastErr.message) || 'unknown error'}`, 'danger');
    }
  }

  function renderRows(items) {
    tableBody.innerHTML = '';
    if (!items || items.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }
    emptyState.classList.add('d-none');

    items.forEach(t => {
      const tr = document.createElement('tr');
      tr.dataset.id = t.id;
      tr.innerHTML = `
        <td>
          <div class="form-check">
            <input class="form-check-input template-checkbox" type="checkbox" value="${t.id}">
          </div>
        </td>
        <td class="fw-medium">${escapeHtml(t.name || '')}</td>
        <td>${escapeHtml(t.description || '')}</td>
        <td>
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit" title="Edit latest version"><i class="bi bi-pencil"></i></button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" title="Delete"><i class="bi bi-trash"></i></button>
          </div>
        </td>`;
      tableBody.appendChild(tr);
    });
    updateDeleteButtonState();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // Search
  function performSearch() {
    const q = (searchInput.value || '').toLowerCase();
    const filtered = templates.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
    renderRows(filtered);
  }

  // Create template (minimal: name prompt)
  async function createTemplate() {
    const name = prompt('Enter new report template name');
    if (!name) return;
    const description = prompt('Enter description (optional)') || '';
    try {
      const res = await fetch(`${apiBase()}/reports.report_templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ name, description, content_md: '' })
      });
      if (!res.ok) {
        const body = await res.text().catch(()=> '');
        throw new Error(`HTTP ${res.status} ${body}`);
      }
      showToast('Success', 'Template created', 'success');
      await fetchTemplates();
    } catch (err) {
      console.error('Create template failed', err);
      showToast('Error', `Failed to create template: ${err.message}`, 'danger');
    }
  }

  // Edit latest version via version modal
  async function openEditModal(id) {
    try {
      const res = await fetch(`${apiBase()}/reports.report_template_versions?template_id=eq.${id}&order=version.desc&limit=1`);
      const versions = await res.json();
      const latest = versions[0];
      const textarea = document.getElementById('versionContent');
      const raw = latest ? latest.content_md : '';
      textarea.value = typeof raw === 'string' ? raw : String(raw || '');

      const saveBtn = document.getElementById('btnSaveVersion');
      saveBtn.onclick = async () => {
        const content = textarea.value;
        const expectedNewVersion = (latest?.version || 0) + 1;
        try {
          // Update latest content on template; trigger will append a new version row automatically
          const res2 = await fetch(`${apiBase()}/reports.report_templates?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify({ content_md: content })
          });
          if (!res2.ok) {
            const body = await res2.text().catch(()=> '');
            throw new Error(`HTTP ${res2.status} ${body}`);
          }
          // Re-fetch latest version to display accurate version number
          let newVersion = expectedNewVersion;
          try {
            const vRes2 = await fetch(`${apiBase()}/reports.report_template_versions?template_id=eq.${id}&order=version.desc&limit=1`);
            const vArr2 = await vRes2.json();
            if (Array.isArray(vArr2) && vArr2[0] && typeof vArr2[0].version === 'number') {
              newVersion = vArr2[0].version;
            }
          } catch (_) {
            // ignore and use expectedNewVersion
          }
          bootstrap.Modal.getInstance(document.getElementById('versionModal')).hide();
          showToast('Success', `Saved version ${newVersion}`, 'success');
          await fetchTemplates();
        } catch (err) {
          console.error('Save version failed', err);
          showToast('Error', 'Failed to save version', 'danger');
        }
      };

      new bootstrap.Modal(document.getElementById('versionModal')).show();
    } catch (err) {
      console.error('Open edit modal failed', err);
      showToast('Error', 'Failed to load latest version', 'danger');
    }
  }

  // Delete
  async function deleteTemplates(ids) {
    try {
      const results = await Promise.all(ids.map(id => fetch(`${apiBase()}/reports.report_templates?id=eq.${id}`, { method: 'DELETE' })));
      const bad = results.find(r => !r.ok);
      if (bad) {
        const body = await bad.text().catch(()=> '');
        throw new Error(`HTTP ${bad.status} ${body}`);
      }
      showToast('Success', `${ids.length} template(s) deleted`, 'success');
      await fetchTemplates();
    } catch (err) {
      console.error('Delete templates failed', err);
      showToast('Error', `Failed to delete templates: ${err.message}`, 'danger');
    }
  }

  // Export
  async function exportSelected(ids) {
    if (!ids.length) return;
    try {
      // fetch minimal metadata and latest version content for each id
      const results = [];
      for (const id of ids) {
        const [tRes, vRes] = await Promise.all([
          fetch(`${apiBase()}/reports.report_templates?id=eq.${id}`),
          fetch(`${apiBase()}/reports.report_template_versions?template_id=eq.${id}&order=version.desc&limit=1`)
        ]);
        const tArr = await tRes.json();
        const vArr = await vRes.json();
        if (tArr[0]) {
          results.push({ ...tArr[0], latest_version: vArr[0] || null });
        }
      }
      const dataStr = JSON.stringify({ report_templates: results }, null, 2);
      const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const name = `report-templates-${new Date().toISOString().split('T')[0]}.json`;
      const a = document.createElement('a');
      a.href = uri; a.download = name; a.click();
      showToast('Success', `${results.length} template(s) exported`, 'success');
    } catch (err) {
      console.error('Export failed', err);
      showToast('Error', 'Failed to export templates', 'danger');
    }
  }

  // Utilities
  function selectedIds() {
    return Array.from(document.querySelectorAll('.template-checkbox:checked')).map(chk => chk.value);
  }
  function updateDeleteButtonState() {
    btnDeleteSelected.disabled = selectedIds().length === 0;
  }

  // Event wiring
  btnCreate.addEventListener('click', createTemplate);
  btnRefresh.addEventListener('click', fetchTemplates);
  btnSelectAll.addEventListener('click', () => {
    document.querySelectorAll('.template-checkbox').forEach(c => c.checked = true);
    chkSelectAll.checked = true; updateDeleteButtonState();
  });
  btnDeselectAll.addEventListener('click', () => {
    document.querySelectorAll('.template-checkbox').forEach(c => c.checked = false);
    chkSelectAll.checked = false; updateDeleteButtonState();
  });
  chkSelectAll.addEventListener('change', e => {
    const checked = e.target.checked;
    document.querySelectorAll('.template-checkbox').forEach(c => c.checked = checked);
    updateDeleteButtonState();
  });
  btnDeleteSelected.addEventListener('click', () => {
    const ids = selectedIds();
    if (!ids.length) return;
    document.getElementById('confirmModalBody').textContent = `Are you sure you want to delete ${ids.length} template${ids.length>1?'s':''}? This cannot be undone.`;
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
    document.getElementById('confirmDeleteBtn').onclick = () => { modal.hide(); deleteTemplates(ids); };
  });
  btnExport.addEventListener('click', () => {
    const ids = selectedIds();
    if (!ids.length) { showToast('Warning', 'Select at least one template to export', 'warning'); return; }
    exportSelected(ids);
  });
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') performSearch(); });

  // delegate row actions
  document.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.dataset.id;
    const action = btn.getAttribute('data-action');
    if (action === 'edit') return openEditModal(id);
    if (action === 'delete') return deleteTemplates([id]);
  });

  // checkbox change updates delete state
  document.addEventListener('change', e => {
    if (e.target.classList.contains('template-checkbox')) {
      const all = document.querySelectorAll('.template-checkbox');
      const checked = document.querySelectorAll('.template-checkbox:checked');
      chkSelectAll.checked = all.length && all.length === checked.length;
      updateDeleteButtonState();
    }
  });

  // initial
  fetchTemplates();
})();
