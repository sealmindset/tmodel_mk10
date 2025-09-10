import React, { useState } from 'react';

export default function TemplateList({ store }) {
  const { templatesList, listTemplates, selectTemplate } = store;
  const [q, setQ] = useState(templatesList.q || '');

  const onSearch = (e) => {
    e.preventDefault();
    listTemplates(q, templatesList.limit, 0);
  };

  const start = templatesList.offset + 1;
  const end = templatesList.offset + templatesList.items.length;
  const total = templatesList.total || 0;
  const canPrev = templatesList.offset > 0 && !templatesList.loading;
  const canNext = (templatesList.offset + templatesList.items.length) < total && !templatesList.loading;

  const prevPage = () => {
    if (!canPrev) return;
    const newOffset = Math.max(0, templatesList.offset - templatesList.limit);
    listTemplates(templatesList.q || '', templatesList.limit, newOffset);
  };
  const nextPage = () => {
    if (!canNext) return;
    const newOffset = templatesList.offset + templatesList.limit;
    listTemplates(templatesList.q || '', templatesList.limit, newOffset);
  };

  return (
    <div className="card mb-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Templates</span>
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
        <div className="d-flex justify-content-between align-items-center mt-2">
          <small className="text-muted">{total > 0 ? `${start}–${end} of ${total}` : '0 of 0'}</small>
          <div className="btn-group">
            <button className="btn btn-sm btn-outline-secondary" onClick={prevPage} disabled={!canPrev}>Prev</button>
            <button className="btn btn-sm btn-outline-secondary" onClick={nextPage} disabled={!canNext}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
