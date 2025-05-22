// Defensive project deletion modal handler for projects list
// Ensures modal and handlers are present and logs errors if not

document.addEventListener('DOMContentLoaded', function () {
  // Delete project modal handling
  let projectIdToDelete = null;
  const deleteModalElem = document.getElementById('deleteConfirmModal');
  const deleteProjectNameSpan = document.getElementById('deleteProjectName');
  const confirmDeleteBtn = document.getElementById('confirmDeleteProject');
  const deleteModal = deleteModalElem ? new bootstrap.Modal(deleteModalElem) : null;

  function showDeleteModal(projectId, projectName) {
    if (!deleteModalElem || !deleteModal || !deleteProjectNameSpan) {
      console.error('Delete modal elements missing');
      alert('Delete modal is not available. Please reload the page.');
      return;
    }
    projectIdToDelete = projectId;
    deleteProjectNameSpan.textContent = projectName;
    deleteModal.show();
  }

  // Attach click handler to all delete buttons
  document.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const projectId = this.getAttribute('data-project-id');
      const projectName = this.getAttribute('data-project-name');
      showDeleteModal(projectId, projectName);
    });
  });

  // Confirm delete
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function () {
      if (!projectIdToDelete) {
        alert('No project selected for deletion.');
        return;
      }
      try {
        const res = await fetch(`/api/projects/${projectIdToDelete}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          if (deleteModal) deleteModal.hide();
          alert('Project deleted.');
          window.location.reload();
        } else {
          alert(`Error deleting project: ${data.error}`);
        }
      } catch (err) {
        console.error('Error deleting project:', err);
        alert(`Error deleting project: ${err.message}`);
      }
    });
  } else {
    console.error('Confirm delete button not found');
  }
});
