import React from 'react';

export default function SubmitProgress({ store }) {
  const submitting = (store.submitState && store.submitState.loading) || false;
  const hasError = !!(store.submitState && store.submitState.error);

  if (!submitting && !hasError) return null;

  return (
    <div className="mb-2" aria-live="polite" aria-atomic="true">
      {submitting && (
        <div className="progress" style={{ height: '6px' }}>
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            role="progressbar"
            aria-label="Submitting"
            style={{ width: '100%' }}
          />
        </div>
      )}
      {hasError && !submitting && (
        <div className="progress" style={{ height: '6px' }}>
          <div
            className="progress-bar bg-danger"
            role="progressbar"
            aria-label="Submit failed"
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
