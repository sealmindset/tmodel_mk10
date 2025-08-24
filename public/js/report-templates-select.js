(function(){
  const MODAL_ID = 'reportTemplatesSelectModal';
  const TBODY_ID = 'reportTemplatesSelectTableBody';
  const EMPTY_ID = 'reportTemplatesSelectEmpty';
  const ASSIGN_BTN_ID = 'assignReportTemplateBtn';

  const ID_INPUT_ID = 'reportTemplateId';
  const NAME_INPUT_ID = 'reportTemplateName';

  const DEFAULT_API_BASE = 'http://localhost:3002';

  function apiBase(){
    const el = document.getElementById('reportTemplatesApiBase');
    return (el && el.value) || DEFAULT_API_BASE;
  }

  function getEls(){
    return {
      modal: document.getElementById(MODAL_ID),
      tbody: document.getElementById(TBODY_ID),
      empty: document.getElementById(EMPTY_ID),
      assignBtn: document.getElementById(ASSIGN_BTN_ID),
      idInput: document.getElementById(ID_INPUT_ID),
      nameInput: document.getElementById(NAME_INPUT_ID)
    };
  }

  function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function setAssignEnabled(enabled){
    const { assignBtn } = getEls();
    if (assignBtn) assignBtn.disabled = !enabled;
  }

  function ensureSingle(container, changed){
    container.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb=>{ if(cb!==changed) cb.checked=false; });
  }

  function getSelected(container){
    const cb = container.querySelector('input[type="checkbox"][data-id]:checked');
    if(!cb) return null;
    return { id: cb.getAttribute('data-id'), name: cb.getAttribute('data-name')||'' };
  }

  async function fetchTemplates(){
    const url = `${apiBase()}/template?order=name.asc`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  function renderRows(tbody, empty, items){
    clear(tbody);
    if(!items.length){
      if (empty) empty.style.display='block';
      setAssignEnabled(false);
      return;
    }
    if (empty) empty.style.display='none';

    items.forEach(t=>{
      const tr = document.createElement('tr');
      const tdCb = document.createElement('td');
      const cb = document.createElement('input');
      cb.type='checkbox';
      cb.setAttribute('data-id', t.id);
      cb.setAttribute('data-name', t.name||'');
      cb.addEventListener('change', ()=>{ ensureSingle(tbody, cb); setAssignEnabled(cb.checked); });
      tdCb.appendChild(cb);

      const tdName = document.createElement('td'); tdName.textContent = t.name || '(untitled)';
      const tdDesc = document.createElement('td'); tdDesc.textContent = t.description || '';

      tr.appendChild(tdCb); tr.appendChild(tdName); tr.appendChild(tdDesc);
      tbody.appendChild(tr);
    });

    setAssignEnabled(false);
  }

  function attach(){
    const { modal, tbody, empty, assignBtn, idInput, nameInput } = getEls();
    if(!modal || !tbody || !assignBtn) return;

    modal.addEventListener('show.bs.modal', async ()=>{
      try{
        setAssignEnabled(false);
        const items = await fetchTemplates();
        renderRows(tbody, empty, items);
      }catch(err){
        console.error('[report-templates-select] load failed', err);
        renderRows(tbody, empty, []);
        alert('Failed to load report templates.');
      }
    });

    assignBtn.addEventListener('click', ()=>{
      const sel = getSelected(tbody);
      if(!sel) return;
      if (idInput) idInput.value = sel.id;
      if (nameInput) nameInput.value = sel.name;
      const instance = bootstrap.Modal.getOrCreateInstance(modal);
      instance.hide();
    });
  }

  document.addEventListener('DOMContentLoaded', attach);
})();
