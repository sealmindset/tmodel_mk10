import React from 'react';

export default function Toolbar({ store }) {
  const { editor, compile, submit, saveTemplate } = store;
  const canSave = editor.name && editor.content;

  const onSave = async () => { await saveTemplate(); };
  const onCompile = async () => { await store.compile(); };
  const onSubmit = async () => { await store.submit({}); };

  return (
    <div className="d-flex gap-2 mb-2">
      <button className="btn btn-primary" disabled={!canSave || !editor.dirty} onClick={onSave}>Save</button>
      <button className="btn btn-outline-secondary" onClick={onCompile}>Compile</button>
      <button className="btn btn-success" onClick={onSubmit}>Submit</button>
    </div>
  );
}
