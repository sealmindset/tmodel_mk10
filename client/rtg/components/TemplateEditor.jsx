import React from 'react';
import { createPortal } from 'react-dom';

export default function TemplateEditor({ store }) {
  const { editor, updateEditor } = store;
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalHtml, setModalHtml] = React.useState('');
  const lastHowToClickRef = React.useRef(0);
  const textareaRef = React.useRef(null);

  // Attach lightweight GFM editor to the textarea once mounted
  React.useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || typeof window === 'undefined' || !window.GFMEditor) return;
    try {
      const inst = new window.GFMEditor(ta);
      ta.__gfm = inst;
      return () => {
        try { inst.destroy?.(); } catch (_) { /* no-op */ }
      };
    } catch (e) {
      // Non-fatal: fall back to plain textarea
      console.error('[RTG] Failed to initialize GFMEditor', e);
    }
  }, []);

  // Keep overlay highlight/size in sync when external content changes
  React.useEffect(() => {
    const inst = textareaRef.current && textareaRef.current.__gfm;
    if (inst && (inst._scheduleGhost || inst.refresh)) {
      try {
        if (inst.refresh) inst.refresh();
        else { inst._autosize?.(); inst._scheduleGhost?.(); }
      } catch (_) { /* ignore */ }
    }
  }, [editor.content]);

  const openHowTo = React.useCallback(() => {
    lastHowToClickRef.current = Date.now();
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', '/rtg/howto', true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            setModalHtml(xhr.responseText || '');
          } else {
            setModalHtml('<div class="text-danger">Failed to load Help content.</div>');
          }
          setModalOpen(true);
        }
      };
      xhr.send();
    } catch (e) {
      setModalHtml('<div class="text-danger">Failed to load Help content.</div>');
      setModalOpen(true);
    }
  }, []);

  // Global capture listener to neutralize any upstream handlers that cause navigation/submit
  React.useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('[data-role="howto-trigger"]')) {
        e.preventDefault?.();
        e.stopPropagation?.();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        openHowTo();
        lastHowToClickRef.current = Date.now();
      }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('pointerdown', handler, true);
    const submitGuard = (e) => {
      const since = Date.now() - lastHowToClickRef.current;
      if (since >= 0 && since < 500) {
        e.preventDefault?.();
        e.stopPropagation?.();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    };
    document.addEventListener('submit', submitGuard, true);
    return () => {
      document.removeEventListener('click', handler, true);
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('pointerdown', handler, true);
      document.removeEventListener('submit', submitGuard, true);
    };
  }, [openHowTo]);

  function AjaxModal({ open, html, onClose }) {
    React.useEffect(() => {
      if (!open) return;
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault?.();
          e.stopPropagation?.();
          onClose?.();
        }
      };
      document.addEventListener('keydown', onKey, true);
      return () => {
        document.removeEventListener('keydown', onKey, true);
      };
    }, [open, onClose]);
    // Notify helper script to center on open and cleanup on close
    React.useEffect(() => {
      if (open) {
        document.dispatchEvent(new Event('rtg-modal:open'));
      } else {
        document.dispatchEvent(new Event('rtg-modal:close'));
      }
    }, [open]);
    if (!open) return null;
    const stop = (e) => { e.preventDefault?.(); e.stopPropagation?.(); };
    return createPortal(
      <div id="rtg-modal">
        <div className="modal fade show" style={{ display: 'block' }} role="dialog" aria-modal="true" onMouseDown={onClose}>
          <div className="modal-dialog modal-lg" onMouseDown={stop}>
            <div className="modal-content modal__panel">
              <div className="modal-header modal__header">
                <h5 className="modal-title">How to write a Template (TOKENS or PROMPT)</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
              </div>
              <div className="modal-body modal__body" dangerouslySetInnerHTML={{ __html: html }} />
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-backdrop fade show" onMouseDown={onClose} />
      </div>,
      document.body
    );
  }

  return (
    <div className="card mb-3"
      onClickCapture={(e) => {
        const el = e.target.closest?.('[data-role="howto-trigger"]');
        if (el) { e.preventDefault?.(); e.stopPropagation?.(); }
      }}
      onMouseDownCapture={(e) => {
        const el = e.target.closest?.('[data-role="howto-trigger"]');
        if (el) { e.preventDefault?.(); e.stopPropagation?.(); }
      }}
      onPointerDownCapture={(e) => {
        const el = e.target.closest?.('[data-role="howto-trigger"]');
        if (el) { e.preventDefault?.(); e.stopPropagation?.(); }
      }}
    >
      <div className="card-header">Editor</div>
      <div className="card-body">
        <div className="mb-2">
          <label className="form-label">Name</label>
          <input className="form-control" value={editor.name} onChange={e => updateEditor({ name: e.target.value })} />
        </div>
        <div className="mb-2">
          <label className="form-label">Description</label>
          <input className="form-control" value={editor.description} onChange={e => updateEditor({ description: e.target.value })} />
        </div>
        <div>
          <div className="d-flex align-items-center mb-1">
            <label className="form-label mb-0">Markdown</label>
            <button
              type="button"
              className="btn btn-link btn-sm ms-2 p-0 align-baseline"
              data-role="howto-trigger"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); lastHowToClickRef.current = Date.now(); openHowTo(); }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openHowTo(); } }}
            >
              How To
            </button>
          </div>
          <textarea
            className="form-control"
            rows={14}
            value={editor.content}
            onChange={e => updateEditor({ content: e.target.value })}
            ref={textareaRef}
          />
        </div>
        {editor.dirty && <div className="small text-warning mt-1">Unsaved changes</div>}
      </div>
      <AjaxModal open={modalOpen} html={modalHtml} onClose={() => setModalOpen(false)} />
    </div>
  );
}
