import React from 'react';

export default function ProjectsSelector({ store }) {
  const { projects, selectedProjectUuid, setSelectedProjectUuid, compile, editor } = store;
  const items = Array.isArray(projects?.items) ? projects.items : [];
  const loading = !!projects?.loading;
  const error = projects?.error;

  const onChange = (e) => {
    const uuid = e.target.value || '';
    setSelectedProjectUuid(uuid);
    // Re-run compile when project changes if editor has content
    if ((editor?.content || '').trim()) {
      compile();
    }
  };

  return (
    <div className="card mb-2">
      <div className="card-header py-1 d-flex align-items-center justify-content-between">
        <strong>Project</strong>
        {loading && <span className="badge bg-secondary">Loading…</span>}
      </div>
      <div className="card-body py-2">
        {error ? (
          <div className="alert alert-danger mb-0">{String(error)}</div>
        ) : (
          <select
            className="form-select"
            value={selectedProjectUuid || ''}
            onChange={onChange}
          >
            <option value="">All projects (unscoped)</option>
            {items.map((p) => {
              const value = String(p.uuid || p.id || '');
              const name = p.name || p.project_name || 'Untitled Project';
              const shortId = value ? ` — ${value.substring(0, 8)}` : '';
              return (
                <option key={value || name} value={value}>
                  {name}{shortId}
                </option>
              );
            })}
          </select>
        )}
      </div>
    </div>
  );
}
