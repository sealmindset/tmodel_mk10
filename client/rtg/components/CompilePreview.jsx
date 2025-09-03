import React from 'react';

export default function CompilePreview({ store }) {
  const { compile } = store;
  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Compile Preview</span>
        {compile.loading ? <span className="badge bg-secondary">Compiling…</span> : null}
      </div>
      <div className="card-body">
        {compile.error && <div className="alert alert-danger py-1">{compile.error}</div>}
        {compile.warnings && compile.warnings.length > 0 && (
          <div className="alert alert-warning py-2">
            <div className="fw-semibold mb-1">Warnings</div>
            <ul className="mb-0">
              {compile.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
        <pre className="rtg-previewer">{compile.output || 'No preview yet. Click Compile.'}</pre>
      </div>
    </div>
  );
}
