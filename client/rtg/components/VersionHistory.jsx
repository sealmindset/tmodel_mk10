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

  const total = versions.total || 0;
  const start = versions.offset + 1;
  const end = versions.offset + versions.items.length;
  const canPrev = versions.offset > 0 && !versions.loading && selectedTemplate?.id;
  const canNext = (versions.offset + versions.items.length) < total && !versions.loading && selectedTemplate?.id;

  const prevPage = async () => {
    if (!canPrev || !selectedTemplate?.id) return;
    const newOffset = Math.max(0, (versions.offset || 0) - (versions.limit || 5));
    await store.loadVersions(selectedTemplate.id, versions.limit || 5, newOffset);
  };
  const nextPage = async () => {
    if (!canNext || !selectedTemplate?.id) return;
    const newOffset = (versions.offset || 0) + (versions.limit || 5);
    await store.loadVersions(selectedTemplate.id, versions.limit || 5, newOffset);
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
        {selectedTemplate && (
          <div className="d-flex justify-content-between align-items-center mt-2">
            <small className="text-muted">{total > 0 ? `${start}–${end} of ${total}` : '0 of 0'}</small>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" onClick={prevPage} disabled={!canPrev}>Prev</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={nextPage} disabled={!canNext}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
