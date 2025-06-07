// public/js/threat-model-merge.js
// Handles merge form submission and UI feedback for threat model merge page

document.addEventListener('DOMContentLoaded', function () {
  const mergeForm = document.getElementById('mergeForm');
  const mergeAlertContainer = document.getElementById('mergeAlertContainer');

  if (!mergeForm) return;

  mergeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAlert();
    setLoading(true);

    // Get selected primary model
    const primaryRadio = document.querySelector('input[name="primaryModel"]:checked');
    if (!primaryRadio) {
      showAlert('Please select a primary threat model.', 'danger');
      setLoading(false);
      return;
    }
    const primaryModelId = primaryRadio.value;

    // Get selected source models
    const sourceCheckboxes = document.querySelectorAll('.source-model-checkbox:checked');
    const sourceModelIds = Array.from(sourceCheckboxes).map(cb => cb.value);
    if (sourceModelIds.length === 0) {
      showAlert('Please select at least one source threat model to merge.', 'danger');
      setLoading(false);
      return;
    }

    // Prevent merging a model into itself
    if (sourceModelIds.includes(primaryModelId)) {
      showAlert('Primary model cannot also be a source model.', 'danger');
      setLoading(false);
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
      if (result.success) {
        showAlert('Threat models merged successfully!', 'success');
        setLoading(false);
        // Optionally reload or update UI here
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showAlert(result.error || 'Merge failed. Please try again.', 'danger');
        setLoading(false);
      }
    } catch (err) {
      showAlert('An error occurred while merging: ' + (err.message || err), 'danger');
      setLoading(false);
    }
  });

  function showAlert(message, type = 'info') {
    mergeAlertContainer.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
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
});
