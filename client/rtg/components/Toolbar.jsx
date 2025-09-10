import React, { useEffect, useMemo, useState } from 'react';

const PRESETS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
  ollama: ['llama3.1', 'llama3.2', 'qwen2.5:14b', 'phi4']
};

const LS_KEY = 'rtg.submit.prefs';

export default function Toolbar({ store }) {
  const { editor, submit, saveTemplate } = store;
  const submitting = (store.submitState && store.submitState.loading) || false;
  const canSave = editor.name && editor.content;
  const isGenRpt = (typeof window !== 'undefined' && window.__RTG_MODE__ === 'genrpt');

  // Provider/Model controls (persisted)
  const [provider, setProvider] = useState('openai');
  const [modelPreset, setModelPreset] = useState('gpt-4o-mini');
  const [customModel, setCustomModel] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.modelPreset) setModelPreset(parsed.modelPreset);
        if (parsed.customModel) setCustomModel(parsed.customModel);
        // Safety: if custom selected but no custom value, use provider default preset
        const prov = parsed.provider || 'openai';
        const models = PRESETS[prov] || [];
        if (parsed.modelPreset === '__custom__' && !parsed.customModel && models.length > 0) {
          setModelPreset(models[0]);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ provider, modelPreset, customModel }));
    } catch (_) {}
  }, [provider, modelPreset, customModel]);

  // Reset default model when provider changes
  useEffect(() => {
    const defaults = PRESETS[provider] || [];
    setModelPreset(defaults[0] || '');
  }, [provider]);

  const models = useMemo(() => PRESETS[provider] || [], [provider]);
  const effectiveModel = modelPreset === '__custom__' ? (customModel || '') : modelPreset;

  const onSave = async () => { await saveTemplate(); };
  const onSubmit = async () => { if (provider && effectiveModel) await store.submit({ provider, model: effectiveModel }); };

  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
      {isGenRpt && (
        <a href="/projects" className="btn btn-outline-secondary d-flex align-items-center gap-2">
          <i className="bi bi-arrow-left"></i>
          <span>Back to Projects</span>
        </a>
      )}
      <button className="btn btn-primary" disabled={!canSave || !editor.dirty} onClick={onSave}>Save</button>

      <div className="btn-group" role="group" aria-label="Provider">
        <input type="radio" className="btn-check" name="rtg-provider" id="rtg-prov-openai" autoComplete="off"
               checked={provider === 'openai'} onChange={() => setProvider('openai')} disabled={submitting} />
        <label className="btn btn-outline-primary" htmlFor="rtg-prov-openai">OpenAI</label>

        <input type="radio" className="btn-check" name="rtg-provider" id="rtg-prov-ollama" autoComplete="off"
               checked={provider === 'ollama'} onChange={() => setProvider('ollama')} disabled={submitting} />
        <label className="btn btn-outline-primary" htmlFor="rtg-prov-ollama">Ollama</label>
      </div>

      <div className="input-group" style={{ maxWidth: '320px' }}>
        <label className="input-group-text" htmlFor="rtg-model">Model</label>
        <select id="rtg-model" className="form-select" value={modelPreset} onChange={e => setModelPreset(e.target.value)} disabled={submitting}>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
          <option value="__custom__">Custom…</option>
        </select>
        {modelPreset === '__custom__' && (
          <input className="form-control" placeholder={provider === 'openai' ? 'e.g. gpt-4o-mini' : 'e.g. llama3.1'}
                 value={customModel} onChange={e => setCustomModel(e.target.value)} disabled={submitting} />
        )}
      </div>

      <button className="btn btn-success d-flex align-items-center gap-2" onClick={onSubmit}
              disabled={!provider || !effectiveModel || submitting}>
        {submitting && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  );
}
