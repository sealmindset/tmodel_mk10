(function () {
  const MODAL_ID = 'promptsSelectModal';
  const TABLE_BODY_ID = 'promptsSelectTableBody';
  const EMPTY_ID = 'promptsSelectEmpty';
  const ASSIGN_BTN_ID = 'assignPromptBtn';

  function log(...args) {
    console.log('[prompts-select]', ...args);
  }

  function getElements() {
    return {
      modalEl: document.getElementById(MODAL_ID),
      tbody: document.getElementById(TABLE_BODY_ID),
      emptyEl: document.getElementById(EMPTY_ID),
      assignBtn: document.getElementById(ASSIGN_BTN_ID),
      promptIdInput: document.getElementById('promptId'),
      promptTitleInput: document.getElementById('promptTitle'),
    };
  }

  async function fetchPrompts() {
    log('fetchPrompts start');
    const res = await fetch('/api/prompts');
    if (!res.ok) throw new Error('Failed to fetch prompts');
    const data = await res.json();
    // Expecting { success: true, prompts: [...] } or array
    const list = Array.isArray(data) ? data : (data.prompts || []);
    log('fetchPrompts success: count=', list.length);
    return list;
  }

  function clearTable(tbody) {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  }

  function ensureSingleSelection(container, changed) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"][data-prompt-id]');
    checkboxes.forEach(cb => {
      if (cb !== changed) cb.checked = false;
    });
  }

  function getSelected(container) {
    const cb = container.querySelector('input[type="checkbox"][data-prompt-id]:checked');
    if (!cb) return null;
    return {
      id: cb.getAttribute('data-prompt-id'),
      title: cb.getAttribute('data-prompt-title') || '',
    };
  }

  function setAssignEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
  }

  function renderRows(tbody, emptyEl, prompts) {
    clearTable(tbody);
    if (!prompts || prompts.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      setAssignEnabled(document.getElementById(ASSIGN_BTN_ID), false);
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    prompts.forEach(p => {
      const tr = document.createElement('tr');

      const tdCb = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-prompt-id', p.id || p.prompt_id || p.uuid || '');
      cb.setAttribute('data-prompt-title', p.title || p.name || '');
      cb.addEventListener('change', () => {
        ensureSingleSelection(tbody, cb);
        setAssignEnabled(document.getElementById(ASSIGN_BTN_ID), cb.checked);
      });
      tdCb.appendChild(cb);

      const tdTitle = document.createElement('td');
      tdTitle.textContent = p.title || p.name || '(untitled)';

      tr.appendChild(tdCb);
      tr.appendChild(tdTitle);
      tbody.appendChild(tr);
    });

    // Start with none selected
    setAssignEnabled(document.getElementById(ASSIGN_BTN_ID), false);
  }

  function attachModalHandlers() {
    const { modalEl, tbody, emptyEl, assignBtn, promptIdInput, promptTitleInput } = getElements();
    if (!modalEl || !tbody || !assignBtn) return;

    // Bootstrap modal events: show.bs.modal
    modalEl.addEventListener('show.bs.modal', async () => {
      try {
        log('modal show: fetching prompts');
        setAssignEnabled(assignBtn, false);
        const prompts = await fetchPrompts();
        renderRows(tbody, emptyEl, prompts);
      } catch (e) {
        log('fetch error', e);
        renderRows(tbody, emptyEl, []);
        alert('Failed to load prompts.');
      }
    });

    assignBtn.addEventListener('click', () => {
      const selection = getSelected(tbody);
      if (!selection) return;
      log('assign selected', selection);
      if (promptIdInput) promptIdInput.value = selection.id;
      if (promptTitleInput) promptTitleInput.value = selection.title;
      // Dismiss modal
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
      modalInstance.hide();
      // Optional toast
      try {
        const toastEl = document.getElementById('globalToast');
        if (toastEl) {
          toastEl.querySelector('.toast-body').textContent = `Assigned prompt: ${selection.title}`;
          bootstrap.Toast.getOrCreateInstance(toastEl).show();
        }
      } catch (_) {}
    });
  }

  document.addEventListener('DOMContentLoaded', attachModalHandlers);
})();
