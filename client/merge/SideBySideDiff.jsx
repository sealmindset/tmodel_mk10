// SideBySideDiff.jsx
// Interactive side-by-side diff viewer for merge preview with action controls
import React, { useState, useEffect } from 'react';

export default function SideBySideDiff({ left, right, onSourceSelectionChange }) {
  const [leftContent, setLeftContent] = useState([]);
  const [rightContent, setRightContent] = useState([]);
  const [selectedRightThreats, setSelectedRightThreats] = useState([]);

  useEffect(() => {
    if (!left || !right) {
      console.log('[LOG][SideBySideDiff] useEffect: Left or Right prop missing, setting empty content.');
      setLeftContent([]);
      setRightContent([]);
      return;
    }

    // Always expect left.threats and right.threats to be pre-populated arrays.
    // If not, default to empty, do not re-parse here.
    const newLeftThreats = Array.isArray(left.threats) ? left.threats : [];
    setLeftContent(newLeftThreats);
    console.log('[LOG][SideBySideDiff] useEffect: Setting leftContent. Received left.threats:', JSON.parse(JSON.stringify(left.threats || [])), 'Resulting leftContent:', JSON.parse(JSON.stringify(newLeftThreats)));

    const newRightThreats = Array.isArray(right.threats) ? right.threats : [];
    setRightContent(newRightThreats);
    console.log('[LOG][SideBySideDiff] useEffect: Setting rightContent. Received right.threats:', JSON.parse(JSON.stringify(right.threats || [])), 'Resulting rightContent:', JSON.parse(JSON.stringify(newRightThreats)));

  }, [left, right]);

  const selectThreat = (threat) => {
    const alreadySelected = selectedRightThreats.some(t => t.title === threat.title);
    let updatedSelected;
    if (alreadySelected) {
      updatedSelected = selectedRightThreats.filter(t => t.title !== threat.title);
    } else {
      updatedSelected = [...selectedRightThreats, threat];
    }
    setSelectedRightThreats(updatedSelected);
    if (onSourceSelectionChange) {
      onSourceSelectionChange(updatedSelected);
    }
  };

  return (
    <div className="merge-diff-container">
      {/* Side-by-Side Diff Row */}
      <div className="row">
        {/* Left Model (Primary) */}
        <div className="col-md-5">
          <div className="card h-100">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h6 className="mb-0">{left?.title || 'Primary Model'}</h6>
              <span className="badge bg-secondary">{leftContent.length} threats</span>
            </div>
            <div className="card-body threat-list">
              {leftContent.map((threat, idx) => (
                <div key={`left-${idx}`} className="threat-item disabled">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={false}
                      disabled
                      id={`left-threat-${idx}`}
                    />
                    <label className="form-check-label" htmlFor={`left-threat-${idx}`}>
                      {threat.title}
                      <small className="d-block text-muted">
                        {threat.content.substring(0, 50)}{threat.content.length > 50 ? '...' : ''}
                      </small>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Actions */}
        <div className="col-md-2 d-flex align-items-center justify-content-center flex-column">
          <i className="bi bi-arrow-right-circle h2 text-muted"></i>
        </div>

        {/* Right Model (Source) */}
        <div className="col-md-5">
          <div className="card h-100">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h6 className="mb-0">{right?.title || 'Source Model'}</h6>
              <span className="badge bg-primary">{rightContent.length} threats</span>
            </div>
            <div className="card-body threat-list">
              {rightContent.map((threat, idx) => (
                <div
                  key={`right-${idx}`}
                  className={`threat-item ${selectedRightThreats.some(t => t.title === threat.title) ? 'selected' : ''}`}
                  onClick={() => selectThreat(threat)}
                >
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={selectedRightThreats.some(t => t.title === threat.title)}
                      onChange={() => {}}
                      id={`right-threat-${idx}`}
                    />
                    <label className="form-check-label" htmlFor={`right-threat-${idx}`}>
                      {threat.title}
                      <small className="d-block text-muted">
                        {threat.content.substring(0, 50)}{threat.content.length > 50 ? '...' : ''}
                      </small>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
