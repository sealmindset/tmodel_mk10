// MergePreviewModal.jsx
// Modal for previewing and confirming a merge between two models
import React, { useState, useEffect } from 'react';
import SideBySideDiff from './SideBySideDiff';

export default function MergePreviewModal({ preview, onClose, onMergeComplete }) {
  const [selectedSourceThreats, setSelectedSourceThreats] = useState([]);
  const [mergedThreats, setMergedThreats] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    let timer;
    if (submitting) {
      timer = setTimeout(() => setShowSlowNotice(true), 1000);
    } else {
      setShowSlowNotice(false);
    }
    return () => clearTimeout(timer);
  }, [submitting]);

  useEffect(() => {
    if (preview && preview.primary) {
      const initialThreats = Array.isArray(preview.primary.threats) ? preview.primary.threats : [];
      setMergedThreats(initialThreats);
    }
  }, [preview]);

  if (!preview) return null;

  const { primary, sources } = preview;
  if (!primary || !sources || sources.length === 0) {
    return (
      <div className="modal show" style={{ display: 'block' }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Error</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <p>Invalid data provided for merge preview.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveMerge = async () => {
    setSubmitting(true); // Move to very top for instant feedback
    setError(null);
    setSuccess(null);

    if (selectedSourceThreats.length === 0) {
      alert('Please select at least one threat from the source model to merge.');
      setSubmitting(false);
      return;
    }

    if (!window.confirm('Are you sure you want to save this merge? This will overwrite the primary model.')) {
      setSubmitting(false);
      return;
    }

    const finalContent = mergedThreats.map(threat => {
      return `## ${threat.title}\n\n${threat.content}`;
    }).join('\n\n');

    const payload = {
      primaryId: preview.primary.id,
      sourceIds: preview.sources.map(m => m.id),
      mergedContent: finalContent,
      selectedThreatTitles: mergedThreats.map(t => t.title)
    };

    try {
      const response = await fetch('/api/threat-models/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save merged threat model.');
      }

      // Notify parent to refresh data, then close the modal
      if (onMergeComplete) {
        await onMergeComplete();
      }
      if (onClose) {
        onClose();
      }

    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSourceSelectionChange = (sourceThreats) => {
    setSelectedSourceThreats(sourceThreats);
    const primaryThreats = Array.isArray(preview.primary.threats) ? preview.primary.threats : [];
    const combined = [...primaryThreats, ...sourceThreats];
    const uniqueThreats = Array.from(new Set(combined.map(t => t.title)))
      .map(title => combined.find(t => t.title === title));
    setMergedThreats(uniqueThreats);
  };

  return (
    <>
      {/* Main modal */}
      <div className="modal show" style={{ display: 'block' }} tabIndex="-1">
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="bi bi-diagram-3 me-2"></i>
                Merge Threat Models
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close" id="merge-modal-close-btn"></button>
            </div>
            <div className="modal-body p-0">
              {success && (
                <div className="alert alert-success m-3">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  Merge completed successfully! Redirecting to view the merged model...
                </div>
              )}
            
              {error && (
                <div className="alert alert-danger m-3">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </div>
              )}
            
              <div className="p-3">
                {preview.primary.response && (
                  <div><strong>Response (response):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.primary.response}</pre></div>
                )}
                {preview.primary.text && (
                  <div><strong>Response (text):</strong> <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{preview.primary.text}</pre></div>
                )}
                {/* Show all possible subject and response fields for source model */}

                <hr />
                {console.log('[LOG][MergePreviewModal] Data for SideBySideDiff - Primary:', JSON.parse(JSON.stringify(preview.primary)))}
                <SideBySideDiff 
                  left={preview.primary} 
                  right={preview.sources[0]} 
                  onSourceSelectionChange={handleSourceSelectionChange}
                />

                {/* Merged Preview Section */}
                <div className="row mt-4">
                  <div className="col-12">
                    <div className="card">
                      <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">Merged Result Preview</h6>
                        <span className="badge bg-light text-dark">{mergedThreats.length} threats</span>
                      </div>
                      <div className="card-body">
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          This is a preview of the merged threats. Click 'Save Merge' to confirm.
                        </div>
                        <div className="merged-threats">
                          {mergedThreats.map((threat, idx) => (
                            <div key={`merged-${idx}`} className="merged-threat-item">
                              <i className="bi bi-check-circle-fill text-success me-2"></i>
                              <strong>{threat.title}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer bg-light">
              <div className="me-auto">
                <small className="text-muted">
                  <i className="bi bi-info-circle me-1"></i>
                  Selected {selectedSourceThreats.length} source threats to merge.
                </small>
              </div>
              <button 
                className="btn btn-outline-secondary" 
                onClick={onClose} 
                disabled={submitting}
                aria-label="Cancel merge modal"
                id="merge-cancel-btn"
              >
                <i className="bi bi-x me-1" aria-hidden="true"></i>
                Cancel
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleSaveMerge} 
                disabled={submitting || selectedSourceThreats.length === 0}
                aria-label="Save merged threat model"
                id="merge-save-btn"
                type="button"
              >
                {submitting ? (
                  <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span>
                ) : (
                  <>
                    <i className="bi bi-check2 me-1" aria-hidden="true"></i>
                    Save Merge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      

    </>
  );
}
