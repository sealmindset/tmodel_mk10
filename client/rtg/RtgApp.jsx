import React, { useEffect, useMemo } from 'react';
import { useRtgStore } from './state/useRtgStore';
import TemplateList from './components/TemplateList';
import TemplateEditor from './components/TemplateEditor';
import CompilePreview from './components/CompilePreview';
import SubmitOutput from './components/SubmitOutput';
import SubmitPanel from './components/SubmitPanel';
import VersionHistory from './components/VersionHistory';
import TokenSidebar from './components/TokenSidebar';
import Toolbar from './components/Toolbar';
import ProjectsSelector from './components/ProjectsSelector';
import './styles/rtg.css';

export default function RtgApp() {
  const store = useRtgStore();
  const { init } = store;

  // Run once on mount; do not depend on `init` identity which can change as store updates
  useEffect(() => { init(); }, []);

  return (
    <div
      className="rtg-app container-fluid"
      onSubmitCapture={(e) => {
        const allow = e.target?.closest?.('[data-allow-submit]');
        if (!allow) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="row mb-2">
        <div className="col-12">
          <h2>Report Template Generator (RTG)</h2>
        </div>
      </div>
      <div className="row">
        <div className="col-3">
          <TemplateList store={store} />
          <VersionHistory store={store} />
        </div>
        <div className="col-6">
          <Toolbar store={store} />
          <TemplateEditor store={store} />
          <ProjectsSelector store={store} />
          <SubmitOutput store={store} />
        </div>
        <div className="col-3">
          <SubmitPanel store={store} />
          <CompilePreview store={store} />
          <TokenSidebar store={store} />
        </div>
      </div>
    </div>
  );
}
