// ModelContentModal.jsx
// Modal popup for viewing a threat model's response content
import React from 'react';

export default function ModelContentModal({ show, model, onHide }) {
  // Debug: Log on every render to verify mounting and props
// eslint-disable-next-line no-console
console.log('[ModelContentModal] Rendered. show:', show, 'model:', model);
  if (!show || !model) return null;
  return (
    <div className="modal show" style={{ display: 'block' }} tabIndex="-1" onMouseLeave={onHide}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{model.title}</h5>
            <button type="button" className="btn-close" onClick={onHide} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {/* Show all possible subject fields for debugging */}
            {model.subject && (
              <div><strong>Subject (subject):</strong> {model.subject}</div>
            )}
            {model.subject_text && (
              <div><strong>Subject (subject_text):</strong> {model.subject_text}</div>
            )}
            <div><strong>Description:</strong> {model.description}</div>
            <div><strong>Last updated:</strong> {model.updated_at}</div>
            <hr />
            <div>
              <strong>Response (response_text):</strong>
              <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{model.response_text}</pre>
            </div>
            {model.response && (
              <div>
                <strong>Response (response):</strong>
                <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{model.response}</pre>
              </div>
            )}
            {model.text && (
              <div>
                <strong>Response (text):</strong>
                <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>{model.text}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
