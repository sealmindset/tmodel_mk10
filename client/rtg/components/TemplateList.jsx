import React, { useState } from 'react';

export default function TemplateList({ store }) {
  const { templatesList, listTemplates, selectTemplate, newTemplate } = store;
  const [q, setQ] = useState(templatesList.q || '');

  const onSearch = (e) => {
    e.preventDefault();
    listTemplates(q, templatesList.limit, 0);
  };

  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Templates</span>
        <button className="btn btn-sm btn-primary" onClick={newTemplate}>New</button>
      </div>
      <div className="card-body">
        <form className="mb-2" onSubmit={onSearch}>
          <div className="input-group">
            <input className="form-control" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
            <button className="btn btn-outline-secondary" disabled={templatesList.loading} type="submit">Search</button>
          </div>
        </form>
        {templatesList.loading && <div className="text-muted">Loading…</div>}
        {!templatesList.loading && templatesList.items.length === 0 && <div className="text-muted">No templates.</div>}
        <ul className="list-group">
          {templatesList.items.map(t => (
            <li key={t.id} className="list-group-item list-group-item-action" onClick={() => selectTemplate(t.id)}>
              <div className="fw-semibold">{t.name}</div>
              {t.description ? <div className="small text-muted">{t.description}</div> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
