// SideBySideDiff.jsx
// Interactive side-by-side diff viewer for merge preview with action controls
import React, { useState, useEffect } from 'react';

export default function SideBySideDiff({ left, right, onSelectionChange }) {
  const [mergedContent, setMergedContent] = useState([]);
  const [leftContent, setLeftContent] = useState([]);
  const [rightContent, setRightContent] = useState([]);
  
  // Parse the threat model content into sections
  useEffect(() => {
    if (!left || !right) return;
    
    // Process left model content
    const leftThreats = parseThreatsFromModel(left.response_text);
    setLeftContent(leftThreats);
    
    // Process right model content
    const rightThreats = parseThreatsFromModel(right.response_text);
    setRightContent(rightThreats);
    
    // Initial merged content is all threats from both models
    const initialMerged = [...new Set([...leftThreats, ...rightThreats])];
    setMergedContent(initialMerged);
  }, [left, right]);
  
  // Handle selecting a threat from either side
  const selectThreat = (threat, side) => {
    let updatedMerged;
    
    // Check if threat is already in merged content by comparing titles
    const threatExists = mergedContent.some(t => t.title === threat.title);
    
    if (threatExists) {
      // Remove the threat
      updatedMerged = mergedContent.filter(t => t.title !== threat.title);
    } else {
      // Add the threat
      updatedMerged = [...mergedContent, threat];
    }
    
    setMergedContent(updatedMerged);
    if (onSelectionChange) {
      onSelectionChange(updatedMerged);
    }
  };
  
  // Helper to parse threats from model text
  const parseThreatsFromModel = (text) => {
    if (!text) return [];
    
    // Split the text into sections by '##' headers
    const sections = text.split(/(?=## )/g);
    
    // Filter out empty sections and transform into objects with title and content
    const threats = sections
      .filter(section => section.trim().length > 0)
      .map(section => {
        // Extract title (first line without ##)
        const titleMatch = section.match(/^## (.*?)(?:\n|$)/);
        const title = titleMatch ? titleMatch[1].trim() : 'Unnamed Threat';
        
        // Extract content (everything after the title)
        const content = section.replace(/^## .*?(?:\n|$)/, '').trim();
        
        return { title, content, fullSection: section.trim() };
      });
    
    console.log('Parsed threats:', threats.length);
    return threats;
  };
  
  return (
    <div className="merge-diff-container">
      <div className="row mb-3">
        <div className="col-12 text-center">
          <h5 className="text-primary mb-3">Select which threats to include in the merged model</h5>
          <div className="btn-group mb-2" role="group">
            <button 
              type="button" 
              className="btn btn-outline-primary" 
              onClick={() => {
                // Create a unique list by title
                const allTitles = new Set([...leftContent, ...rightContent].map(t => t.title));
                const allThreats = [];
                
                allTitles.forEach(title => {
                  // Find the first threat with this title from either side
                  const threat = leftContent.find(t => t.title === title) || 
                               rightContent.find(t => t.title === title);
                  if (threat) allThreats.push(threat);
                });
                
                setMergedContent(allThreats);
              }}
            >
              Include All Threats
            </button>
            <button 
              type="button" 
              className="btn btn-outline-primary" 
              onClick={() => setMergedContent([...leftContent])}
            >
              Use Left Only
            </button>
            <button 
              type="button" 
              className="btn btn-outline-primary"
              onClick={() => setMergedContent([...rightContent])}
            >
              Use Right Only
            </button>
          </div>
        </div>
      </div>
      
      <div className="row">
        {/* Left Model */}
        <div className="col-md-5">
          <div className="card h-100">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
              <h6 className="mb-0">{left?.title || 'Primary Model'}</h6>
              <span className="badge bg-primary">{leftContent.length} threats</span>
            </div>
            <div className="card-body threat-list">
              {leftContent.map((threat, idx) => (
                <div 
                  key={`left-${idx}`} 
                  className={`threat-item ${mergedContent.some(t => t.title === threat.title) ? 'selected' : ''}`}
                  onClick={() => selectThreat(threat, 'left')}
                >
                  <div className="form-check">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      checked={mergedContent.some(t => t.title === threat.title)} 
                      onChange={() => {}} 
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
          <div className="text-center mb-4">
            <i className="bi bi-arrow-left-right fs-3 text-secondary"></i>
          </div>
        </div>
        
        {/* Right Model */}
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
                  className={`threat-item ${mergedContent.some(t => t.title === threat.title) ? 'selected' : ''}`}
                  onClick={() => selectThreat(threat, 'right')}
                >
                  <div className="form-check">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      checked={mergedContent.some(t => t.title === threat.title)} 
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
      
      {/* Merged Preview */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Merged Result</h6>
              <span className="badge bg-light text-dark">{mergedContent.length} threats</span>
            </div>
            <div className="card-body">
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                Preview of merged threats. Click Save Merge to complete the operation.
              </div>
              <div className="merged-threats">
                {mergedContent.map((threat, idx) => (
                  <div key={`merged-${idx}`} className="merged-threat-item">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <strong>{threat.title}</strong>
                    <div className="mt-1 ms-4 text-muted">
                      {threat.content.length > 100 
                        ? `${threat.content.substring(0, 100)}...` 
                        : threat.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
