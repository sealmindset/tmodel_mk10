import React from 'react';

export default function SubmitOutput({ store }) {
  const submit = store.submitState || {};
  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Output</span>
        {submit.loading ? <span className="badge bg-secondary">Submitting…</span> : null}
      </div>
      <div className="card-body">
        {submit.error && <div className="alert alert-danger py-1">{submit.error}</div>}
        <pre className="rtg-previewer small">{submit.output || 'No output yet. Click Submit.'}</pre>
      </div>
    </div>
  );
}
