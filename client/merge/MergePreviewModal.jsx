// MergePreviewModal.jsx
// Modal for previewing and confirming a merge between two models
import React, { useState, useEffect } from 'react';
import SideBySideDiff from './SideBySideDiff';

export default function MergePreviewModal({ preview, onClose }) {
  // Debug: Log preview object on every render
  // eslint-disable-next-line no-console
  console.log('[MergePreviewModal] Rendered. preview:', preview);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedThreats, setSelectedThreats] = useState([]);
  
  // Log when the modal is shown or hidden for debugging
  useEffect(() => {
    if (preview) {
      console.log('MergePreviewModal is now visible with data:', preview);
    }
  }, [preview]);
  
  if (!preview) return null;
  if (preview.loading) {
    return (
      <div className="modal show" style={{ display: 'block' }} tabIndex="-1">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-diagram-3 me-2"></i>
                Loading Threat Model Details...
              </h5>
            </div>
            <div className="modal-body d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}>
              <div className="spinner-border text-primary me-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span>Loading full model details for merge preview...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  async function handleMerge() {
    setMerging(true);
    setError(null);
    setSuccess(false);
    console.log('Starting merge with selected threats:', selectedThreats);
    
    try {
      // Prepare the content for the merged model
      let mergedContent = "";
      
      // If we have selected threats, build the content from them
      if (selectedThreats && selectedThreats.length > 0) {
        // Build merged content from selected threats with full content
        mergedContent = selectedThreats.map(threat => {
          return `## ${threat.title}\n\n${threat.content}`;
        }).join('\n\n');
      }
      
      // Enhanced merge payload with selected threats
      const payload = {
        primaryId: preview.primary.id, 
        sourceIds: preview.sources.map(m => m.id),
        mergedContent: mergedContent, // Include the full formatted content
        selectedThreatTitles: selectedThreats.length > 0 ? selectedThreats.map(t => t.title) : undefined
      };
      
      console.log('Sending merge payload:', payload);
      
      const res = await fetch('/api/threat-models/merge-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error || 'Merge failed');
      
      setSuccess(true);
      
      // Close the modal after a brief delay to show success message
      setTimeout(() => {
        onClose();
        // Force reload the page to show updated models
        window.location.reload();
      }, 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setMerging(false);
    }
  }
  
  // Handle selection changes from the SideBySideDiff component
  const handleSelectionChange = (threats) => {
    setSelectedThreats(threats);
    console.log('Selected threats updated:', threats.length, 'threats');
  };

  return (
    <div className="modal show" style={{ display: 'block' }} tabIndex="-1">
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-diagram-3 me-2"></i>
              Merge Threat Models
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body p-0">
            {/* Success toast/alert disabled for debugging modal display */}
            {/*
            {success && (
              <div className="alert alert-success m-3">
                <i className="bi bi-check-circle-fill me-2"></i>
                Merge completed successfully! Redirecting...
              </div>
            )}
            */}
            
            {error && (
              <div className="alert alert-danger m-3">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}
            
            <div className="p-3">
              {/* Show all possible subject and response fields for primary model */}
              <div className="mb-3">
                <h6>Primary Model Details</h6>
                {preview.primary.subject && (
                  <div><strong>Subject (subject):</strong> {preview.primary.subject}</div>
                )}
                {preview.primary.subject_text && (
                  <div><strong>Subject (subject_text):</strong> {preview.primary.subject_text}</div>
                )}
                <div><strong>Description:</strong> {preview.primary.description}</div>
                <div><strong>Last updated:</strong> {preview.primary.updated_at}</div>
                <div><strong>Response (response_text):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.primary.response_text}</pre></div>
                {preview.primary.responseText && (
                  <div><strong>Response (responseText):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.primary.responseText}</pre></div>
                )}
                {preview.primary.response && (
                  <div><strong>Response (response):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.primary.response}</pre></div>
                )}
                {preview.primary.text && (
                  <div><strong>Response (text):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.primary.text}</pre></div>
                )}
              </div>
              {/* Show all possible subject and response fields for source model */}
              <div className="mb-3">
                <h6>Source Model Details</h6>
                {preview.sources[0] && preview.sources[0].subject && (
                  <div><strong>Subject (subject):</strong> {preview.sources[0].subject}</div>
                )}
                {preview.sources[0] && preview.sources[0].subject_text && (
                  <div><strong>Subject (subject_text):</strong> {preview.sources[0].subject_text}</div>
                )}
                <div><strong>Description:</strong> {preview.sources[0] && preview.sources[0].description}</div>
                <div><strong>Last updated:</strong> {preview.sources[0] && preview.sources[0].updated_at}</div>
                <div><strong>Response (response_text):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.sources[0] && preview.sources[0].response_text}</pre></div>
                {preview.sources[0] && preview.sources[0].responseText && (
                  <div><strong>Response (responseText):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.sources[0].responseText}</pre></div>
                )}
                {preview.sources[0] && preview.sources[0].response && (
                  <div><strong>Response (response):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.sources[0].response}</pre></div>
                )}
                {preview.sources[0] && preview.sources[0].text && (
                  <div><strong>Response (text):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.sources[0].text}</pre></div>
                )}
              </div>
              <hr />
              <SideBySideDiff 
                left={preview.primary} 
                right={preview.sources[0]} 
                onSelectionChange={handleSelectionChange}
              />
            </div>
          </div>
          <div className="modal-footer bg-light">
            <div className="me-auto">
              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                Selected {selectedThreats.length} threats for the merged model
              </small>
            </div>
            <button 
              className="btn btn-outline-secondary" 
              onClick={onClose} 
              disabled={merging}
            >
              <i className="bi bi-x me-1"></i>
              Cancel
            </button>
            <button 
              className="btn btn-success" 
              onClick={handleMerge} 
              disabled={merging || selectedThreats.length === 0}
            >
              {merging ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Processing...
                </>
              ) : (
                <>
                  <i className="bi bi-check2 me-1"></i>
                  Save Merge
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
