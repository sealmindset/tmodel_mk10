// basic admin UI for report templates
const apiInput = document.getElementById('apiBase');
const tblBody = document.querySelector('#templatesTbl tbody');
const btnCreate = document.getElementById('btnCreate');
const nameInput = document.getElementById('newName');
const descInput = document.getElementById('newDesc');

let templates = [];

async function fetchTemplates() {
  const res = await fetch(`${apiInput.value}/template`);
  templates = await res.json();
  renderTable();
}

function renderTable() {
  tblBody.innerHTML = '';
  templates.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.description || ''}</td>
      <td>
        <button class="btn btn-sm btn-secondary me-2" data-action="edit" data-id="${t.id}">Edit</button>
      </td>`;
    tblBody.appendChild(tr);
  });
}

btnCreate.addEventListener('click', async () => {
  if (!nameInput.value.trim()) return;
  const body = { name: nameInput.value.trim(), description: descInput.value.trim() };
  await fetch(`${apiInput.value}/template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  nameInput.value = '';
  descInput.value = '';
  fetchTemplates();
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if (action === 'edit') {
    await openEditModal(id);
  }
});

async function openEditModal(id) {
  const res = await fetch(`${apiInput.value}/template_version?template_id=eq.${id}&order=version.desc&limit=1`);
  const versions = await res.json();
  const latest = versions[0];
  const textarea = document.getElementById('versionContent');
  textarea.value = JSON.stringify(latest ? latest.content : { sections: {} }, null, 2);
  const saveBtn = document.getElementById('btnSaveVersion');
  saveBtn.onclick = async () => {
    let content;
    try {
      content = JSON.parse(textarea.value);
    } catch (err) {
      alert('Invalid JSON');
      return;
    }
    const newVersion = (latest?.version || 0) + 1;
    await fetch(`${apiInput.value}/template_version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: id, version: newVersion, content })
    });
    const modalEl = document.getElementById('versionModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    fetchTemplates();
  };
  const modal = new bootstrap.Modal(document.getElementById('versionModal'));
  modal.show();
}

// initial load
fetchTemplates();
