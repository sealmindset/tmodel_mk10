import React, { useEffect, useMemo } from 'react';
import { useRtgStore } from './state/useRtgStore';
import TemplateList from './components/TemplateList';
import TemplateEditor from './components/TemplateEditor';
import SubmitOutput from './components/SubmitOutput';
import VersionHistory from './components/VersionHistory';
import TokenSidebar from './components/TokenSidebar';
import Toolbar from './components/Toolbar';
import SubmitProgress from './components/SubmitProgress';
import ProjectsSelector from './components/ProjectsSelector';
import './styles/rtg.css';

export default function RtgApp() {
  const store = useRtgStore();
  const { init } = store;

  // Run once on mount; do not depend on `init` identity which can change as store updates
  useEffect(() => { init(); }, []);

  const isGenRpt = (typeof window !== 'undefined' && window.__RTG_MODE__ === 'genrpt');

  if (isGenRpt) {
    // Simplified Generate Report layout per mock: left templates, center controls + output, no editor/version sidebar
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
        <div className="row">
          <div className="col-3">
            <TemplateList store={store} />
            {/* Hide VersionHistory in genrpt mode */}
          </div>
          <div className="col-9">
            <SubmitProgress store={store} />
            <Toolbar store={store} />
            {/* No TemplateEditor in genrpt mode */}
            <ProjectsSelector store={store} />
            <SubmitOutput store={store} />
          </div>
        </div>
      </div>
    );
  }

  // Default RTG authoring layout
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
      <div className="row">
        <div className="col-3">
          <TemplateList store={store} />
          <VersionHistory store={store} />
        </div>
        <div className="col-6">
          <SubmitProgress store={store} />
          <Toolbar store={store} />
          <TemplateEditor store={store} />
          <ProjectsSelector store={store} />
          <SubmitOutput store={store} />
        </div>
        <div className="col-3">
          <TokenSidebar store={store} />
        </div>
      </div>
    </div>
  );
}
