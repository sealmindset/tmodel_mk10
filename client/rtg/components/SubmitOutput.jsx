import React, { useEffect, useRef } from 'react';

export default function SubmitOutput({ store }) {
  const submit = store.submitState || {};
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
    const next = submit.output || '';
    if (ta.value !== next) {
      ta.value = next;
      try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    }
  }, [submit.output]);

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
            defaultValue={submit.output || ''}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}
          />
        ) : (
          <pre className="rtg-previewer small">{submit.output || 'No output yet. Click Submit.'}</pre>
        )}
      </div>
    </div>
  );
}
