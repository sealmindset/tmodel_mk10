'use strict';

(function() {
  // Simple helpers
  function $(id) { return document.getElementById(id); }

  // Lightweight UUIDv4 generator for browsers
  function uuidv4() {
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      // Per RFC 4122 section 4.4
      buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
      const hex = [...buf].map(b => b.toString(16).padStart(2, '0'));
      return (
        hex.slice(0,4).join('') + '-' +
        hex.slice(4,6).join('') + '-' +
        hex.slice(6,8).join('') + '-' +
        hex.slice(8,10).join('') + '-' +
        hex.slice(10,16).join('')
      );
    }
    // Fallback (lower entropy)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // XHR helpers (GET/POST JSON) with timeout per user rule: use XHR and open CORS
  function xhrJson(method, url, body, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        if (body != null) xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = timeoutMs;
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            const status = xhr.status;
            const text = xhr.responseText || '';
            console.log('[REPORTS-GEN][XHR]', method, url, 'status=', status);
            if (status >= 200 && status < 300) {
              try { resolve(text ? JSON.parse(text) : {}); } catch (e) { resolve({}); }
            } else {
              let errMsg = 'HTTP ' + status;
              try { const e = JSON.parse(text); if (e && e.error) errMsg += ': ' + e.error; } catch(_) {}
              reject(new Error(errMsg));
            }
          }
        };
        xhr.ontimeout = () => reject(new Error('timeout'));
        xhr.onerror = () => reject(new Error('network_error'));
        xhr.send(body != null ? JSON.stringify(body) : null);
      } catch (e) { reject(e); }
    });
  }

  function setBusy(isBusy) {
    const status = $('statusArea');
    const btnGen = $('btnGenerate');
    const btnCancel = $('btnCancel');
    if (status) status.style.display = isBusy ? 'inline-block' : 'none';
    if (btnGen) btnGen.disabled = isBusy;
    if (btnCancel) btnCancel.disabled = !isBusy;
  }

  function showAlert(msg) {
    const el = $('genAlert');
    if (!el) return;
    el.textContent = msg || 'Unexpected error';
    el.style.display = 'block';
  }
  function clearAlert() {
    const el = $('genAlert');
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
  }
  function showInfo(msg) {
    const el = $('genInfo');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  // Load templates via PostgREST
  async function loadTemplates() {
    const base = $('postgrestBase')?.value || 'http://localhost:3010';
    // Use unqualified /template which maps to reports.template (reports first in db-schemas)
    const url = base.replace(/\/$/, '') + '/template?select=id,name,description&order=created_at.desc';
    try {
      const data = await xhrJson('GET', url, null, 15000);
      const list = Array.isArray(data) ? data : (data?.data || []);
      const sel = $('templateId');
      if (!sel) return;
      sel.innerHTML = '';
      const def = document.createElement('option');
      def.value = '';
      def.textContent = list.length ? 'Select a template…' : 'No templates found';
      sel.appendChild(def);
      list.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name || ('Template ' + t.id);
        sel.appendChild(opt);
      });
    } catch (e) {
      console.error('[REPORTS-GEN] Failed to load templates:', e);
      const sel = $('templateId');
      if (sel) {
        sel.innerHTML = '';
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'Error loading templates';
        sel.appendChild(o);
      }
      showAlert('Failed to load templates from PostgREST');
    }
  }

  // Validate UUID v4 (for project UUID)
  function isUuidV4(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((s||'').trim());
  }

  async function onGenerate() {
    clearAlert();
    showInfo('');

    const projectId = $('projectId')?.value?.trim();
    const reportType = $('reportType')?.value;
    const templateId = $('templateId')?.value;

    if (!projectId || !isUuidV4(projectId)) {
      showAlert('Please enter a valid Project UUID.');
      return;
    }
    if (!reportType) {
      showAlert('Please select a report type.');
      return;
    }
    if (!templateId || isNaN(Number(templateId))) {
      showAlert('Please select a report template.');
      return;
    }

    setBusy(true);
    try {
      // Call server generator
      const payload = {
        reportType,
        templateId: Number(templateId),
        filters: { projectUuid: projectId }
      };
      const genResp = await xhrJson('POST', '/api/reports/generate', payload, 45000);
      const content = genResp?.generatedReport || '';
      $('resultMd').value = content;
      $('btnSave').disabled = !content;
      showInfo('Generation complete. You can edit and then save the report.');
    } catch (e) {
      console.error('[REPORTS-GEN] Generate failed:', e);
      showAlert('Generate failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    clearAlert();
    const md = $('resultMd')?.value || '';
    const projectId = $('projectId')?.value?.trim();
    const templateId = $('templateId')?.value || null;
    const title = ($('reportName')?.value || '').trim() || 'Generated Report';
    const base = $('postgrestBase')?.value || 'http://localhost:3010';
    if (!md) { showAlert('Nothing to save yet. Generate first.'); return; }
    if (!projectId || !isUuidV4(projectId)) { showAlert('Please enter a valid Project UUID.'); return; }

    // PostgREST insert into reports.report. With reports first in db-schemas, use unqualified /report
    const url = base.replace(/\/$/, '') + '/report';
    const templateIdVal = (templateId && !isNaN(Number(templateId))) ? Number(templateId) : null;
    if (!templateIdVal) { showAlert('Please select a Template before saving.'); return; }
    const body = {
      project_uuid: projectId,
      title: title,
      template_id: templateIdVal,
      content: { sections: { full: md } }
    };

    setBusy(true);
    try {
      const resp = await xhrJson('POST', url, body, 30000);
      // PostgREST returns inserted row(s)
      const inserted = Array.isArray(resp) ? resp[0] : (resp?.[0] || resp);
      const newId = inserted?.id || inserted?.report_id || null;
      if (newId) {
        window.location.href = '/reports/view/' + encodeURIComponent(newId);
      } else {
        showInfo('Saved, but could not determine report ID.');
      }
    } catch (e) {
      console.error('[REPORTS-GEN] Save failed:', e);
      showAlert('Save failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    // Wire buttons
    const btnGen = $('btnGenerate');
    const btnSave = $('btnSave');
    const btnCancel = $('btnCancel');
    if (btnGen) btnGen.addEventListener('click', onGenerate);
    if (btnSave) btnSave.addEventListener('click', onSave);
    if (btnCancel) btnCancel.addEventListener('click', () => showInfo('Cancelled.'));

    // Load templates from PostgREST
    loadTemplates();

    // Prompts modal: prompts-select.js should dispatch a custom event when a prompt is chosen
    // Listen for a generic event and fill fields if present
    document.addEventListener('prompt:selected', function(e) {
      try {
        const detail = e.detail || {};
        if (detail.id) $('promptId').value = detail.id;
        if (detail.title) $('promptTitle').value = detail.title;
      } catch(_) {}
    });
  });
})();
