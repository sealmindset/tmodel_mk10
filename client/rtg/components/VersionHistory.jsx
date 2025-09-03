import React from 'react';

export default function VersionHistory({ store }) {
  const { selectedTemplate, versions } = store;

  const onRefresh = async () => {
    if (selectedTemplate?.id) await store.loadVersions(selectedTemplate.id);
  };

  const onView = async (v) => {
    // For v1, simply replace editor content with selected version (requires explicit Save)
    store.updateEditor({ content: v.content_md || '' });
  };

  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Versions</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={onRefresh} disabled={!selectedTemplate}>Refresh</button>
      </div>
      <div className="card-body">
        {!selectedTemplate && <div className="text-muted">Select a template to view versions.</div>}
        {selectedTemplate && versions.loading && <div className="text-muted">Loading…</div>}
        {selectedTemplate && !versions.loading && versions.items.length === 0 && <div className="text-muted">No versions yet.</div>}
        <ul className="list-group">
          {versions.items.map(v => (
            <li key={`${v.version}`} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">v{v.version} <span className="text-muted small">{new Date(v.created_at).toLocaleString()}</span></div>
                {v.changelog ? <div className="small text-muted">{v.changelog}</div> : null}
              </div>
              <button className="btn btn-sm btn-outline-primary" onClick={() => onView(v)}>Restore to editor</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
