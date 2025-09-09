'use strict';

(function() {
  // Simple helpers
  function $(id) { return document.getElementById(id); }

  // Page-scoped alert helpers for this view
  function showAlert(message, type = 'danger') {
    const el = $('genAlert');
    if (!el) { console.warn('[REPORTS-GEN] Missing #genAlert element'); return; }
    el.className = `alert alert-${type}`;
    el.innerHTML = message || '';
    el.style.display = message ? 'block' : 'none';
  }
  function showInfo(message) {
    const el = $('genInfo');
    if (!el) { console.warn('[REPORTS-GEN] Missing #genInfo element'); return; }
    el.className = 'alert alert-info';
    el.innerHTML = message || '';
    el.style.display = message ? 'block' : 'none';
  }
  // Toast helper (Bootstrap 5). Falls back gracefully if Bootstrap unavailable.
  function showToast(message, type = 'success', delayMs = 1500) {
    try {
      const container = document.getElementById('toastContainer');
      if (!container) return; // no-op if container missing
      const wrapper = document.createElement('div');
      wrapper.className = 'toast align-items-center text-bg-' + (type === 'success' ? 'success' : (type === 'danger' ? 'danger' : 'secondary')) + ' border-0';
      wrapper.setAttribute('role', 'status');
      wrapper.setAttribute('aria-live', 'polite');
      wrapper.setAttribute('aria-atomic', 'true');
      wrapper.innerHTML = '<div class="d-flex">\
        <div class="toast-body">' + (message || '') + '</div>\
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>\
      </div>';
      container.appendChild(wrapper);
      // Bootstrap toast init if available
      const Toast = window.bootstrap && window.bootstrap.Toast ? window.bootstrap.Toast : null;
      if (Toast) {
        const t = new Toast(wrapper, { delay: delayMs });
        t.show();
        // Clean up DOM after hidden
        wrapper.addEventListener('hidden.bs.toast', () => { try { wrapper.remove(); } catch(_) {} });
      } else {
        // Fallback: simple auto-remove
        wrapper.style.display = 'block';
        setTimeout(() => { try { wrapper.remove(); } catch(_) {} }, delayMs);
      }
    } catch(_) {}
  }
  function clearAlert() {
    const a = $('genAlert'); const i = $('genInfo');
    if (a) { a.style.display = 'none'; a.innerHTML = ''; }
    if (i) { i.style.display = 'none'; i.innerHTML = ''; }
  }
  
  // Diagnostics for #resultMd content flow
  let _resultMdLast = null;
  let _resultMdMonitor = null;
  // Token vocabulary aligned with RTG usage
  const ALLOWED_TOKENS = new Set([
    '{{PROJECT_JSON}}',
    '{{COMPONENT_TABLE}}',
    '{{THREAT_MODEL_DATA_JSON}}',
    '{{COMPONENT_DATA_JSON}}'
  ]);
  function findTokens(text) {
    const re = /\{\{[^}]+\}\}/g;
    const found = new Set();
    let m;
    while ((m = re.exec(text)) !== null) {
      found.add(m[0]);
    }
    return Array.from(found);
  }
  function validateTokens(text) {
    try {
      const warnEl = document.getElementById('tokenWarn');
      if (!warnEl) return;
      const toks = findTokens(text);
      const unknown = toks.filter(t => !ALLOWED_TOKENS.has(t));
      if (unknown.length) {
        warnEl.textContent = 'Unknown tokens: ' + unknown.join(', ');
      } else {
        warnEl.textContent = '';
      }
    } catch(_) {}
  }
  function insertAtCaret(textarea, insertText) {
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    textarea.value = before + insertText + after;
    const pos = start + insertText.length;
    try {
      textarea.selectionStart = pos;
      textarea.selectionEnd = pos;
      textarea.focus();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    } catch(_) {}
  }
  function setResultMd(text, source) {
    const el = $('resultMd');
    if (!el) { return; }
    const t = (typeof text === 'string') ? text : (text == null ? '' : String(text));
    // Log length and preview to help detect prompt/template leakage
    try {
      console.log('[REPORTS-GEN] Setting #resultMd from', source, {
        length: t.length,
        preview: t.slice(0, 200)
      });
    } catch(_) {}
    el.value = t;
    _resultMdLast = t;
    validateTokens(t);
  }
  function startResultMdMonitor(durationMs = 7000, intervalMs = 400) {
    const el = $('resultMd');
    if (!el) return;
    if (_resultMdMonitor) { try { clearInterval(_resultMdMonitor); } catch(_) {} }
    const start = Date.now();
    let last = el.value;
    _resultMdMonitor = setInterval(() => {
      if ((Date.now() - start) > durationMs) {
        try { clearInterval(_resultMdMonitor); } catch(_) {}
        _resultMdMonitor = null;
        return;
      }
      const cur = el.value;
      if (cur !== last) {
        console.warn('[REPORTS-GEN] #resultMd changed after completion', {
          prevLen: (last || '').length,
          newLen: (cur || '').length,
          preview: String(cur || '').slice(0, 200)
        });
        last = cur;
        _resultMdLast = cur;
      }
    }, intervalMs);
  }

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

  // Streaming XHR helper for Server-Sent Events
  function xhrStream(url, body, onMessage, onError, onComplete) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Accept', 'text/event-stream');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 120000; // 2 minutes for streaming

        // Incremental SSE parsing state
        let lastIndex = 0;
        let buffer = '';

        // Parse one SSE frame string and dispatch via onMessage
        function parseAndDispatch(frame) {
          if (!frame) return;
          const lines = frame.split('\n');
          let eventName = null;
          const dataLines = [];
          for (const line of lines) {
            if (!line) continue;
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).replace(/^\s/, ''));
            }
          }
          if (dataLines.length) {
            const dataStr = dataLines.join('\n');
            try {
              const obj = JSON.parse(dataStr);
              if (eventName && obj.event == null) obj.event = eventName;
              onMessage && onMessage(obj);
            } catch (e) {
              console.warn('[REPORTS-GEN] Failed to parse SSE data JSON:', dataStr, e);
            }
          }
        }

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            // Append new chunk since last parse
            const chunk = xhr.responseText.substring(lastIndex);
            lastIndex = xhr.responseText.length;
            if (chunk) buffer += chunk.replace(/\r\n/g, '\n');

            // Parse complete SSE frames separated by blank line
            let sep;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
              const frame = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              parseAndDispatch(frame);
            }

            if (xhr.readyState === 4) {
              // Process any final leftover (non-delimited) frame on close
              const leftover = buffer.trim();
              if (leftover.length > 0) {
                parseAndDispatch(leftover);
                buffer = '';
              }
              if (xhr.status >= 200 && xhr.status < 300) {
                onComplete && onComplete();
                resolve(xhr.responseText);
              } else {
                const error = new Error(`HTTP ${xhr.status}: ${xhr.statusText}`);
                onError && onError(error);
                reject(error);
              }
            }
          }
        };

        xhr.ontimeout = () => {
          const error = new Error('Request timeout');
          onError && onError(error);
          reject(error);
        };

        xhr.onerror = () => {
          const error = new Error('Network error');
          onError && onError(error);
          reject(error);
        };

        xhr.send(body != null ? JSON.stringify(body) : null);
      } catch (e) {
        onError && onError(e);
        reject(e);
      }
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

  function updateProgress(progressData) {
    const progressEl = $('progressArea');
    const progressBar = $('progressBar');
    const progressText = $('progressText');

    if (!progressEl || !progressBar || !progressText) return;

    // Update progress bar
    if (progressData.progress !== undefined) {
      progressBar.style.width = Math.min(100, Math.max(0, progressData.progress)) + '%';
    }

    // Update progress text
    if (progressData.message) {
      progressText.textContent = progressData.message;
    }

    // Show progress area
    progressEl.style.display = 'block';

    console.log('[REPORTS-GEN] Progress update:', progressData);
  }

  function showProgressArea() {
    const progressEl = $('progressArea');
    if (progressEl) {
      progressEl.style.display = 'block';
      updateProgress({ message: 'Initializing...', progress: 0 });
    }
  }

  function hideProgressArea() {
    const progressEl = $('progressArea');
    if (progressEl) {
      progressEl.style.display = 'none';
    }
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

  // Load RTG templates via PostgREST API view (api.report_templates)
  async function loadTemplates() {
    const base = $('postgrestBase')?.value || 'http://localhost:3010';
    const root = base.replace(/\/$/, '');
    const url = `${root}/report_templates?select=id,uuid,name,description&order=name.asc`;
    try {
      console.log('[reports-generate] loadTemplates fetching', url);
      const data = await xhrJson('GET', url, null, 15000);
      const list = Array.isArray(data) ? data : (data?.data || []);
      const sel = $('templateId');
      if (!sel) return;
      sel.innerHTML = '';
      const def = document.createElement('option');
      def.value = '';
      def.textContent = list.length ? 'Select a template…' : 'No RTG templates found';
      sel.appendChild(def);
      let validCount = 0;
      list.forEach(t => {
        const id = (t && (t.id != null ? t.id : null)); // API view exposes numeric id
        if (id == null || id === '') {
          console.warn('[REPORTS-GEN] Template missing id field, skipping:', t);
          return;
        }
        const opt = document.createElement('option');
        const idStr = String(id);
        opt.value = idStr;
        opt.setAttribute('data-id', idStr);
        // API view id is numeric; also capture uuid for later insert into generated_reports
        const numId = Number(idStr);
        if (!Number.isNaN(numId)) opt.setAttribute('data-numeric-id', String(numId));
        if (t && t.uuid) opt.setAttribute('data-uuid', String(t.uuid));
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
      console.error('[REPORTS-GEN] Failed to load RTG templates (api.report_templates):', e);
      const sel = $('templateId');
      if (sel) {
        sel.innerHTML = '';
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'Error loading RTG templates';
        sel.appendChild(o);
      }
      showAlert('Failed to load report templates');
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

    // Validate inputs
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
    showProgressArea();
    clearAlert();

    try {
      // Prepare request payload
      const payload = {
        reportType,
        templateId: tid,
        // match RTG: include prompt and llm selections; map identifiers at boundary
        promptId: (document.getElementById('promptId')?.value || '').trim() || undefined,
        promptTitle: (document.getElementById('promptTitle')?.value || '').trim() || undefined,
        filters: {
          projectUuid: projectId,
          llmOverride: { provider: llmProviderValue, model: llmModelValue }
        }
      };

      console.log('[REPORTS-GEN] Starting report generation with streaming');

      // Use streaming for real-time updates
      const cfg = (window.__GENRPT_CFG__ || {});
      const genUrl = cfg.generateUrl || '/api/reports/generate?stream=true';
      await xhrStream(
        genUrl,
        payload,
        // onMessage - handle progress updates
        (data) => {
          if (data.event === 'progress') {
            updateProgress(data);
          } else if (data.event === 'complete') {
            updateProgress({ message: 'Report completed successfully!', progress: 100 });
            setResultMd(data.generatedReport || '', 'sse_complete');
            startResultMdMonitor();
            $('btnSave').disabled = !data.generatedReport;
            showInfo('Generation complete. You can edit and then save the report.');
          } else if (data.event === 'error') {
            showAlert(`Generation failed: ${data.details || data.message || 'Unknown error'}`);
            updateProgress({ message: 'Generation failed', progress: 0 });
          }
        },
        // onError - handle errors
        (error) => {
          console.error('[REPORTS-GEN] Streaming failed:', error);
          showAlert(`Generation failed: ${error.message}`);
          updateProgress({ message: 'Generation failed', progress: 0 });
        },
        // onComplete - cleanup
        () => {
          setBusy(false);
          // Keep progress visible for a moment to show completion
          setTimeout(() => hideProgressArea(), 3000);
        }
      );

    } catch (e) {
      console.error('[REPORTS-GEN] Generate failed:', e);
      showAlert('Generate failed: ' + e.message);
      updateProgress({ message: 'Generation failed', progress: 0 });
      setBusy(false);
      hideProgressArea();
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

    const root = base.replace(/\/$/, '');
    const saveUrl = root + '/generated_reports';
    const templateIdVal = (templateId && !isNaN(Number(templateId))) ? Number(templateId) : null;
    if (!templateIdVal) { showAlert('Please select a Template before saving.'); return; }
    // Resolve template UUID from the selected option
    const tmplSel = $('templateId');
    const tmplOpt = tmplSel && tmplSel.options[tmplSel.selectedIndex] ? tmplSel.options[tmplSel.selectedIndex] : null;
    const templateUuid = tmplOpt ? (tmplOpt.getAttribute('data-uuid') || '') : '';
    if (!templateUuid) {
      showAlert('Template UUID not found. Please re-select the template.');
      return;
    }
    // Resolve latest version for this template (fallback to 1 if lookup fails)
    let latestVersion = 1;
    try {
      const verRows = await xhrJson('GET', `${root}/report_template_versions?template_id=eq.${encodeURIComponent(templateUuid)}&select=version&order=version.desc&limit=1`, null, 15000);
      const arr = Array.isArray(verRows) ? verRows : (verRows?.data || []);
      if (arr && arr[0] && typeof arr[0].version === 'number') latestVersion = arr[0].version;
    } catch (e) {
      console.warn('[REPORTS-GEN] Failed to fetch latest template version, defaulting to 1:', e);
    }
    const body = {
      project_id: projectId,
      template_id: templateUuid,
      template_version: latestVersion,
      output_md: md,
      created_by: (window.__CURRENT_USER__ && window.__CURRENT_USER__.username) || undefined
    };

    setBusy(true);
    // Show a brief progress bar for visual confirmation on save
    showProgressArea();
    updateProgress({ message: 'Saving…', progress: 60 });
    try {
      const resp = await xhrJson('POST', saveUrl, body, 30000);
      // PostgREST returns inserted row(s). api.generated_reports exposes id as numeric api_id
      const inserted = Array.isArray(resp) ? resp[0] : (resp?.[0] || resp);
      const newId = inserted?.id || inserted?.report_id || null;
      if (newId) {
        // Success: fill bar to 100%, show success toast, then redirect after a short delay
        updateProgress({ message: 'Saved successfully', progress: 100 });
        showToast('Report saved', 'success', 1400);
        setTimeout(() => {
          window.location.href = '/reports/view/' + encodeURIComponent(newId);
        }, 1200);
      } else {
        showInfo('Saved, but could not determine report ID.');
      }
    } catch (e) {
      console.error('[REPORTS-GEN] Save failed:', e);
      showAlert('Save failed: ' + e.message);
      updateProgress({ message: 'Save failed', progress: 0 });
    } finally {
      // Keep the progress bar visible briefly for confirmation
      setBusy(false);
      setTimeout(() => hideProgressArea(), 1500);
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

    // Log user edits into the result textarea to differentiate from programmatic changes
    const resMd = $('resultMd');
    if (resMd) {
      resMd.addEventListener('input', function() {
        try {
          const v = resMd.value || '';
          console.log('[REPORTS-GEN] #resultMd user input', { length: v.length, preview: v.slice(0, 120) });
          _resultMdLast = v;
          validateTokens(v);
        } catch(_) {}
      });
    }

    // Token toolbar handlers
    document.querySelectorAll('.insert-token').forEach(btn => {
      btn.addEventListener('click', () => {
        const token = btn.getAttribute('data-token') || '';
        insertAtCaret(resMd, token);
      });
    });

    // Prompts modal: prompts-select.js should dispatch a custom event when a prompt is chosen
    // Listen for a generic event and fill fields if present
    document.addEventListener('prompt:selected', function(e) {
      try {
        const detail = e.detail || {};
        if (detail.id) $('promptId').value = detail.id;
        if (detail.title) $('promptTitle').value = detail.title;
        // Load preview text
        const pid = (detail.id || '').trim();
        if (pid) {
          fetch(`/api/prompts/${encodeURIComponent(pid)}`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error('prompt_fetch_failed')))
            .then(data => {
              const txt = (data && data.prompt && (data.prompt.prompt_text || data.prompt.text)) || '';
              const sec = document.getElementById('promptPreviewSection');
              const ta = document.getElementById('promptPreviewText');
              if (ta) ta.value = txt || '(empty prompt)';
              if (sec) sec.classList.toggle('d-none', !txt);
            })
            .catch(() => {
              const sec = document.getElementById('promptPreviewSection');
              const ta = document.getElementById('promptPreviewText');
              if (ta) ta.value = '';
              if (sec) sec.classList.add('d-none');
            });
        }
      } catch(_) {}
    });
  });
})();
