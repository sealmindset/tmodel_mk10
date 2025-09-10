import { useCallback, useMemo, useReducer } from 'react';
import * as api from '../api/rtgClient';

const initialState = {
  templatesList: { items: [], total: 0, q: '', limit: 5, offset: 0, loading: false },
  selectedTemplate: null,
  editor: { name: '', description: '', content: '', dirty: false },
  compile: { output: '', warnings: [], meta: null, loading: false, error: null },
  submit: { provider: '', model: '', filters: {}, loading: false, output: '', meta: null, error: null },
  versions: { items: [], total: 0, loading: false, error: null, limit: 5, offset: 0 },
  projects: { items: [], loading: false, error: null },
  selectedProjectUuid: '',
};

function reducer(state, patch) {
  return { ...state, ...patch };
}

export function useRtgStore() {
  const [state, setState] = useReducer(reducer, initialState);

  const listTemplates = useCallback(async (q, limit = state.templatesList.limit, offset = 0) => {
    setState({ templatesList: { ...state.templatesList, loading: true, q, limit, offset } });
    try {
      const res = await api.listTemplates(q, limit, offset);
      setState({ templatesList: { ...state.templatesList, ...res, q, limit, offset, loading: false } });
    } catch (e) {
      setState({ templatesList: { ...state.templatesList, loading: false } });
    }
  }, [state.templatesList]);

  // Load projects (declared early so it's safe to reference in init deps)
  const loadProjects = useCallback(async () => {
    setState({ projects: { ...state.projects, loading: true, error: null } });
    try {
      const items = await api.listProjects();
      setState({ projects: { items, loading: false, error: null } });
      if (!state.selectedProjectUuid && Array.isArray(items) && items.length > 0) {
        const first = items[0];
        if (first && (first.id || first.uuid)) {
          setState({ selectedProjectUuid: String(first.id || first.uuid) });
        }
      }
    } catch (e) {
      setState({ projects: { items: [], loading: false, error: e?.message || String(e) } });
    }
  }, [state.projects, state.selectedProjectUuid]);

  const init = useCallback(async () => {
    await Promise.all([
      listTemplates(''),
      loadProjects()
    ]);
  }, [listTemplates, loadProjects]);

  const selectTemplate = useCallback(async (id) => {
    try {
      const t = await api.getTemplate(id);
      try { console.log('[RTG] selectTemplate', { id, name: t?.name, hasContent: !!t?.content_md, contentLen: (t?.content_md || '').length }); } catch (_) {}
      setState({
        selectedTemplate: t,
        editor: { name: t.name || '', description: t.description || '', content: t.content_md || '', dirty: false },
      });
      // In genrpt mode, show a preview in the same textarea used for output
      try {
        if (typeof window !== 'undefined' && window.__RTG_MODE__ === 'genrpt') {
          const preview = t.content_md || '';
          try { console.log('[RTG] preview -> submit.output', { length: preview.length, preview: preview.slice(0, 120) }); } catch (_) {}
          setState({ submit: { ...state.submit, output: preview } });
        }
      } catch (_) {}
      await loadVersions(id, state.versions.limit || 5, 0);
    } catch (_) {}
  }, [state.versions.limit, state.submit]);

  const newTemplate = useCallback(() => {
    setState({
      selectedTemplate: null,
      editor: { name: '', description: '', content: '', dirty: false },
      versions: { items: [], total: 0, loading: false, error: null, limit: 5, offset: 0 },
    });
  }, []);

  const updateEditor = useCallback((patch) => {
    setState({ editor: { ...state.editor, ...patch, dirty: true } });
  }, [state.editor]);

  const saveTemplate = useCallback(async () => {
    const { selectedTemplate, editor } = state;
    const payload = { name: editor.name, description: editor.description, content_md: editor.content };
    if (!payload.name || !payload.content_md) return false;
    if (selectedTemplate?.id) {
      const updated = await api.updateTemplate(selectedTemplate.id, payload);
      setState({ selectedTemplate: updated, editor: { ...state.editor, dirty: false } });
      return true;
    } else {
      const created = await api.createTemplate(payload);
      setState({ selectedTemplate: created, editor: { ...state.editor, dirty: false } });
      await listTemplates(state.templatesList.q);
      return true;
    }
  }, [state, listTemplates]);

  const compile = useCallback(async () => {
    setState({ compile: { ...state.compile, loading: true, error: null } });
    try {
      const { content } = state.editor;
      const proj = state.selectedProjectUuid ? { projectUuid: state.selectedProjectUuid } : {};
      const res = await api.compile({ content, filters: proj });
      setState({ compile: { ...res, loading: false } });
    } catch (e) {
      setState({ compile: { output: '', warnings: [], meta: null, loading: false, error: e?.message || String(e) } });
    }
  }, [state.compile, state.editor, state.selectedProjectUuid]);

  const submit = useCallback(async (opts = {}) => {
    setState({ submit: { ...state.submit, loading: true, error: null } });
    console.log('[RTG] submit:start', { opts });
    try {
      const { content } = state.editor;
      const { selectedTemplate } = state;
      const { provider = '', model = '', filters = {} } = opts || {};
      const proj = state.selectedProjectUuid ? { projectUuid: state.selectedProjectUuid } : {};
      const mergedFilters = { ...filters, ...proj };
      const res = await api.submit({ content, provider, model, filters: mergedFilters, templateId: selectedTemplate?.id || null });
      setState({ submit: { ...res, loading: false } });
      console.log('[RTG] submit:success', { meta: res?.meta, outputLen: (res?.output || '').length });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error('[RTG] submit:error', msg);
      setState({ submit: { output: '', meta: null, loading: false, error: msg } });
    }
  }, [state.submit, state.editor, state.selectedTemplate, state.selectedProjectUuid]);

  const setSelectedProjectUuid = useCallback((uuid) => {
    setState({ selectedProjectUuid: uuid || '' });
  }, []);

  const loadVersions = useCallback(async (id, limit = state.versions.limit || 5, offset = state.versions.offset || 0) => {
    setState({ versions: { ...state.versions, loading: true, error: null, limit, offset } });
    try {
      const res = await api.listVersions(id, limit, offset);
      setState({ versions: { ...res, loading: false, limit, offset } });
    } catch (e) {
      setState({ versions: { items: [], total: 0, loading: false, error: e?.message || String(e), limit, offset } });
    }
  }, [state.versions]);

  return useMemo(() => ({
    ...state,
    compileState: state.compile,
    submitState: state.submit,
    init,
    loadProjects,
    listTemplates,
    selectTemplate,
    newTemplate,
    updateEditor,
    saveTemplate,
    compile,
    submit,
    loadVersions,
    setSelectedProjectUuid,
  }), [state, init, listTemplates, selectTemplate, newTemplate, updateEditor, saveTemplate, compile, submit, loadVersions]);
}
