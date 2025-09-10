import React, { useEffect, useRef } from 'react';

export default function SubmitOutput({ store }) {
  const submit = store.submitState || {};
  const compile = store.compileState || {};
  const taRef = useRef(null);
  const hasGfm = (typeof window !== 'undefined' && window.GFMEditor);

  // Initialize lightweight GFM editor when available (handles late script load)
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const tryInit = () => {
      if (cancelled) return;
      const ta = taRef.current;
      if (!ta) { timer = setTimeout(tryInit, 100); return; }
      if (ta.__gfmEditor) return; // already initialized
      if (typeof window === 'undefined' || !window.GFMEditor) { timer = setTimeout(tryInit, 100); return; }
      try {
        window.GFMEditor.autoInit('textarea[data-gfm-editor]');
      } catch (_) { /* ignore */ }
    };
    tryInit();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  // Keep textarea value in sync with streaming output
  useEffect(() => {
    if (!taRef.current) return;
    const ta = taRef.current;
    // Prefer submit.output if present; otherwise show compiled output (authoring mode)
    const next = (submit.output && submit.output.length > 0) ? submit.output : (compile.content || '');
    if (ta.value !== next) {
      ta.value = next;
      try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }
  }, [submit.output, compile.content]);

  // Auto-compile on editor content or selected project change in authoring mode
  useEffect(() => {
    const isGenRpt = (typeof window !== 'undefined' && window.__RTG_MODE__ === 'genrpt');
    if (isGenRpt) return; // genrpt uses template preview/submit flow
    if (!store || !store.compile) return;
    // Debounce slightly to avoid excessive calls while typing
    let t = setTimeout(() => {
      try {
        store.compile();
      } catch (_) {}
    }, 250);
    return () => { if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.editor?.content, store?.selectedProjectUuid]);

  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Output</span>
        {submit.loading ? <span className="badge bg-secondary">Submitting…</span> : null}
      </div>
      <div className="card-body">
        {submit.error && <div className="alert alert-danger py-1">{submit.error}</div>}
        {(typeof window !== 'undefined' && window.GFMEditor) ? (
          <textarea
            ref={taRef}
            data-gfm-editor
            className="form-control"
            rows={18}
            placeholder="No output yet. Click Submit."
            defaultValue={submit.output || compile.content || ''}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}
          />
        ) : (
          <pre className="rtg-previewer small">{submit.output || compile.content || 'No output yet. Click Submit.'}</pre>
        )}
      </div>
    </div>
  );
}
