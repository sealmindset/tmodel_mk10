import React, { useEffect, useMemo, useState } from 'react';

const PRESETS = {
  openai: [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
    'o4-mini'
  ],
  ollama: [
    'llama3.1',
    'llama3.2',
    'qwen2.5:14b',
    'phi4'
  ]
};

const LS_KEY = 'rtg.submit.prefs';

export default function SubmitPanel({ store }) {
  const submitState = store.submitState || {};
  const submitAction = store.submit;
  const [provider, setProvider] = useState('openai');
  const [modelPreset, setModelPreset] = useState('gpt-4o-mini');
  const [customModel, setCustomModel] = useState('');

  // Load persisted
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.modelPreset) setModelPreset(parsed.modelPreset);
        if (parsed.customModel) setCustomModel(parsed.customModel);
      }
    } catch (_) {}
  }, []);

  // Persist on changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ provider, modelPreset, customModel }));
    } catch (_) {}
  }, [provider, modelPreset, customModel]);

  // Reset model preset when provider switches
  useEffect(() => {
    const defaults = PRESETS[provider] || [];
    setModelPreset(defaults[0] || '');
  }, [provider]);

  const models = useMemo(() => PRESETS[provider] || [], [provider]);
  const effectiveModel = modelPreset === '__custom__' ? (customModel || '') : modelPreset;

  const disabled = !!submitState.loading;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!provider || !effectiveModel) return;
    await submitAction({ provider, model: effectiveModel });
  };

  return (
    <div className="card mb-3">
      <div className="card-header">Submit to LLM</div>
      <div className="card-body">
        <form onSubmit={onSubmit} data-allow-submit>
          <div className="mb-3">
            <div className="btn-group" role="group" aria-label="Provider">
              <input type="radio" className="btn-check" name="provider" id="prov-openai" autoComplete="off"
                     checked={provider === 'openai'} onChange={() => setProvider('openai')} />
              <label className="btn btn-outline-primary" htmlFor="prov-openai">OpenAI</label>

              <input type="radio" className="btn-check" name="provider" id="prov-ollama" autoComplete="off"
                     checked={provider === 'ollama'} onChange={() => setProvider('ollama')} />
              <label className="btn btn-outline-primary" htmlFor="prov-ollama">Ollama</label>
            </div>
          </div>

          <div className="mb-2">
            <label className="form-label">Model</label>
            <div className="input-group">
              <select className="form-select" value={modelPreset} onChange={e => setModelPreset(e.target.value)}>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Custom…</option>
              </select>
              {modelPreset === '__custom__' && (
                <input className="form-control" placeholder={provider === 'openai' ? 'e.g. gpt-4o-mini' : 'e.g. llama3.1'}
                       value={customModel} onChange={e => setCustomModel(e.target.value)} />
              )}
            </div>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-success" type="submit" disabled={disabled || !effectiveModel}>Submit</button>
            {submitState.loading && <span className="align-self-center text-muted">Submitting…</span>}
          </div>
        </form>

        {submitState.error && <div className="alert alert-danger py-1 mt-3">{submitState.error}</div>}
      </div>
    </div>
  );
}
