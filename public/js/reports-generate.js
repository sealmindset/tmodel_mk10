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
              try {
                const e = JSON.parse(text);
                if (e && e.error) errMsg += ': ' + e.error;
                if (e && e.details) errMsg += ' — ' + e.details;
              } catch(_) {}
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

  async function loadModelsForProvider(provider) {
    const modelSel = $('llmModel');
    const help = $('llmHelp');
    if (!modelSel) return;
    modelSel.innerHTML = '';
    try {
      if (provider === 'ollama') {
        const data = await xhrJson('GET', '/api/ollama-models', null, 15000);
        const models = Array.isArray(data?.models) ? data.models : [];
        const list = models.length ? models : [{ name: 'llama3:latest' }];
        list.forEach(m => {
          const opt = document.createElement('option');
          const val = m.name || m;
          opt.value = val;
          opt.textContent = m.label || val;
          modelSel.appendChild(opt);
        });
        if (help) help.textContent = 'Using local Ollama models.';
      } else {
        const data = await xhrJson('GET', '/api/openai-models', null, 15000);
        const models = Array.isArray(data?.models) ? data.models : [];
        const list = models.length ? models : ['gpt-4'];
        list.forEach(id => {
          const opt = document.createElement('option');
          opt.value = typeof id === 'string' ? id : (id?.name || 'gpt-4');
          opt.textContent = opt.value;
          modelSel.appendChild(opt);
        });
        if (help) help.textContent = 'Using OpenAI API.';
      }
    } catch (e) {
      console.warn('[REPORTS-GEN] Failed to load model list for', provider, e);
      const opt = document.createElement('option');
      opt.value = provider === 'ollama' ? 'llama3:latest' : 'gpt-4';
      opt.textContent = opt.value;
      modelSel.appendChild(opt);
    }
  }

  // Load templates via PostgREST
  async function loadTemplates() {
    const base = $('postgrestBase')?.value || 'http://localhost:3010';
    const root = base.replace(/\/$/, '');
    const urls = [
      `${root}/template?select=id,name,description&order=created_at.desc`,
      `${root}/reports.template?select=id,name,description&order=created_at.desc`,
      `${root}/report_templates.template?select=id,name,description&order=created_at.desc`
    ];
    try {
      let data = null;
      let lastErr = null;
      for (const u of urls) {
        try {
          console.log('[reports-generate] loadTemplates trying', u);
          data = await xhrJson('GET', u, null, 15000);
          if (Array.isArray(data) ? data.length : (data?.data?.length)) {
            console.log('[reports-generate] loadTemplates succeeded via', u);
            break;
          }
        } catch (e) {
          lastErr = e;
          console.warn('[reports-generate] loadTemplates failed via', u, e);
        }
      }
      if (!data) throw lastErr || new Error('No templates endpoint responded');
      const list = Array.isArray(data) ? data : (data?.data || []);
      const sel = $('templateId');
      if (!sel) return;
      sel.innerHTML = '';
      const def = document.createElement('option');
      def.value = '';
      def.textContent = list.length ? 'Select a template…' : 'No templates found';
      sel.appendChild(def);
      let validCount = 0;
      list.forEach(t => {
        const id = (t && (t.id != null ? t.id : t.template_id))
          ?? (t && t.templateId) ?? null;
        if (id == null || id === '') {
          console.warn('[REPORTS-GEN] Template missing id field, skipping:', t);
          return;
        }
        const opt = document.createElement('option');
        const idStr = String(id);
        opt.value = idStr;
        opt.setAttribute('data-id', idStr);
        // keep numeric hint if applicable
        const numId = Number(idStr);
        if (!Number.isNaN(numId)) opt.setAttribute('data-numeric-id', String(numId));
        opt.textContent = t.name || ('Template ' + idStr);
        sel.appendChild(opt);
        validCount++;
      });
      // If only one valid template, auto-select it
      if (validCount === 1) sel.selectedIndex = 1;
      // Log final options for diagnostics
      try {
        const opts = Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent }));
        console.log('[REPORTS-GEN] Templates loaded options:', opts);
      } catch(_) {}
      sel.addEventListener('change', () => {
        if (sel.value) clearAlert();
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
    const templateSel = $('templateId');
    const templateIdRaw = templateSel && templateSel.options && templateSel.selectedIndex >= 0
      ? (templateSel.options[templateSel.selectedIndex].getAttribute('data-id')
         || templateSel.options[templateSel.selectedIndex].getAttribute('data-numeric-id')
         || templateSel.options[templateSel.selectedIndex].value
         || '')
      : '';
    const llmProviderField = $('llmProvider');
    const llmModelField = $('llmModel');
    const llmProviderValue = llmProviderField && llmProviderField.value ? llmProviderField.value : 'openai';
    const llmModelValue = llmModelField && llmModelField.value ? llmModelField.value : (llmProviderValue === 'ollama' ? 'llama3:latest' : 'gpt-4');

    if (!projectId || !isUuidV4(projectId)) {
      showAlert('Please enter a valid Project UUID.');
      return;
    }
    if (!reportType) {
      showAlert('Please select a report type.');
      return;
    }
    if (!templateIdRaw) {
      console.warn('[REPORTS-GEN] Empty templateId read, attempting auto-pick. selectedIndex=', (templateSel ? templateSel.selectedIndex : 'n/a'));
      if (templateSel && templateSel.options && templateSel.options.length > 1) {
        // Find first non-empty option
        let picked = null;
        for (let i = 0; i < templateSel.options.length; i++) {
          const opt = templateSel.options[i];
          const val = opt.getAttribute('data-numeric-id');
          if (val) { picked = { idx: i, val }; break; }
        }
        if (picked && picked.idx !== templateSel.selectedIndex) {
          templateSel.selectedIndex = picked.idx;
        }
        if (picked && picked.val) {
          console.log('[REPORTS-GEN] Auto-picked template option', picked);
          // use picked value
          return onGenerate(); // re-run now that selection is set
        }
      }
      try {
        const sel = $('templateId');
        if (sel) {
          const opts = Array.from(sel.options).map((o, idx) => ({ idx, value: o.value, text: o.textContent, selected: idx === sel.selectedIndex }));
          console.log('[REPORTS-GEN] Current template select state:', opts);
        }
      } catch(_) {}
      showAlert('Please select a report template.');
      return;
    }

    // Accept UUID or numeric template id. If neither, resolve by name.
    let tid = null;
    let tidStr = (templateIdRaw || '').trim();
    if (isUuidV4(tidStr)) {
      tid = tidStr; // UUID ok
    } else if (!Number.isNaN(Number(tidStr)) && tidStr !== '') {
      tid = Number(tidStr);
    } else {
      console.warn('[REPORTS-GEN] Selected template id missing/invalid; attempting PostgREST lookup by name. raw=', templateIdRaw);
      // Fallback: resolve by the selected option's text (name)
      const sel = $('templateId');
      const selectedText = (sel && sel.options && sel.selectedIndex >= 0)
        ? (sel.options[sel.selectedIndex].textContent || '').trim()
        : '';
      if (selectedText) {
        try {
          const base = $('postgrestBase')?.value || 'http://localhost:3010';
          const root = base.replace(/\/$/, '');
          // Try unqualified /template first (schema precedence), then /reports.template
          let rows = await xhrJson('GET', `${root}/template?select=id,name&name=eq.${encodeURIComponent(selectedText)}`, null, 15000);
          if (!Array.isArray(rows) || rows.length === 0) {
            rows = await xhrJson('GET', `${root}/reports.template?select=id,name&name=eq.${encodeURIComponent(selectedText)}`, null, 15000);
          }
          const arr = Array.isArray(rows) ? rows : (rows?.data || []);
          const found = arr && arr[0] && arr[0].id;
          if (found != null) {
            tidStr = String(found);
            tid = isUuidV4(tidStr) ? tidStr : (!Number.isNaN(Number(tidStr)) ? Number(tidStr) : null);
            console.log('[REPORTS-GEN] Resolved template id by name:', selectedText, '->', tid);
          } else {
            console.warn('[REPORTS-GEN] Could not resolve template id by name:', selectedText, rows);
          }
        } catch (e) {
          console.warn('[REPORTS-GEN] Lookup by name failed:', e);
        }
      }
      if (tid == null) {
        try {
          if (sel) {
            const opts = Array.from(sel.options).map((o, idx) => ({ idx, value: o.value, data: o.getAttribute('data-numeric-id'), text: o.textContent, selected: idx === sel.selectedIndex }));
            console.log('[REPORTS-GEN] Template options (for debug):', opts);
          }
        } catch(_) {}
        showAlert('Invalid template ID. Please re-select a template.');
        return;
      }
    }

    setBusy(true);
    try {
      // Call server generator
      const payload = {
        reportType,
        templateId: tid,
        filters: { projectUuid: projectId, llmOverride: { provider: llmProviderValue, model: llmModelValue } }
      };
      console.log('[REPORTS-GEN] POST /api/reports/generate payload=', payload);
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

    // PostgREST insert into reports.report (qualified path to avoid schema precedence issues)
    const url = base.replace(/\/$/, '') + '/reports.report';
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

    // Clear alert when a template is chosen
    const tmplSel = $('templateId');
    if (tmplSel) {
      tmplSel.addEventListener('change', () => {
        if (tmplSel.value) clearAlert();
      });
    }

    // Initialize LLM provider/model selectors
    const provSel = $('llmProvider');
    if (provSel) {
      provSel.addEventListener('change', () => {
        const p = provSel.value || 'openai';
        console.log('[REPORTS-GEN] Provider changed to', p);
        loadModelsForProvider(p);
      });
      // Initial populate
      const initialProv = provSel.value || 'openai';
      loadModelsForProvider(initialProv);
    }

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
