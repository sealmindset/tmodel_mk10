// public/js/threat-model-merge.js
// Handles merge form submission and UI feedback for threat model merge page

document.addEventListener('DOMContentLoaded', function () {
  const mergeForm = document.getElementById('mergeForm');
  const mergeAlertContainer = document.getElementById('mergeAlertContainer');

  // Spinner overlay for loading state
  let spinnerOverlay = document.createElement('div');
  spinnerOverlay.id = 'mergeSpinnerOverlay';
  spinnerOverlay.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(255,255,255,0.7);z-index:2000;display:none;align-items:center;justify-content:center;';
  spinnerOverlay.innerHTML = '<div class="spinner-border text-primary" role="status" aria-live="polite" aria-label="Merging..." style="width:3rem;height:3rem;"></div>';
  document.body.appendChild(spinnerOverlay);

  if (!mergeForm) return;

  mergeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAlert();
    setLoading(true);
    showSpinner(true);

    // Get selected primary model
    const primaryRadio = document.querySelector('input[name="primaryModel"]:checked');
    if (!primaryRadio) {
      showAlert('Please select a primary threat model.', 'danger');
      setLoading(false);
      showSpinner(false);
      return;
    }
    const primaryModelId = primaryRadio.value;

    // Get selected source models
    const sourceCheckboxes = document.querySelectorAll('.source-model-checkbox:checked');
    const sourceModelIds = Array.from(sourceCheckboxes).map(cb => cb.value);
    if (sourceModelIds.length === 0) {
      showAlert('Please select at least one source threat model to merge.', 'danger');
      setLoading(false);
      showSpinner(false);
      return;
    }

    // Prevent merging a model into itself
    if (sourceModelIds.includes(primaryModelId)) {
      showAlert('Primary model cannot also be a source model.', 'danger');
      setLoading(false);
      showSpinner(false);
      return;
    }

    try {
      const response = await fetch('/api/threat-models/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          primaryModelId,
          sourceModelIds
        })
      });
      const result = await response.json();
      setLoading(false);
      showSpinner(false);
      if (result.success) {
        // Show detailed success with metrics if available
        let summaryHtml = '<strong>Threat models merged successfully!</strong>';
        if (result.data && result.data.metrics) {
          const m = result.data.metrics;
          summaryHtml += `<br><span class='text-success'>${m.total_threats_added} threats added, ${m.total_threats_skipped} skipped as duplicates.</span>`;
        }
        showAlert(summaryHtml, 'success');
        // Optionally: prompt user to reload
        setTimeout(() => {
          if (confirm('Merge complete! Reload to see updated models?')) {
            window.location.reload();
          }
        }, 1200);
      } else {
        showAlert(result.error || 'Merge failed. Please try again.', 'danger');
      }
    } catch (err) {
      setLoading(false);
      showSpinner(false);
      showAlert('An error occurred while merging: ' + (err.message || err), 'danger');
    }
  });

  function showAlert(message, type = 'info') {
    mergeAlertContainer.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert" aria-live="assertive">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
  }
  function clearAlert() {
    mergeAlertContainer.innerHTML = '';
  }
  function setLoading(loading) {
    const submitBtn = mergeForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading ? '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Merging...' : 'Merge Selected Models';
    }
  }
  function showSpinner(show) {
    spinnerOverlay.style.display = show ? 'flex' : 'none';
  }
});
