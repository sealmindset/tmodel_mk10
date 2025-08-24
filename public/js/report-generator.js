/**
 * Report Generator JavaScript
 * Handles template selection, LLM provider settings, and report generation
 */

let projectData = null;
const DEFAULT_SECTIONS = ['overview','threats','vulnerabilities','mitigations','recommendations'];

/**
 * Initialize the report generator page
 * @param {string} projectId - UUID of the project
 */
function initReportGenerator(projectId) {
  console.log('Initializing report generator for project ID:', projectId);
  
  if (!projectId) {
    showError('No project ID provided');
    return;
  }
  
  // Fetch project data
  fetchProject(projectId)
    .then(setupProjectInfo)
    .catch(error => {
      console.error('Error loading project:', error);
      showError(`Failed to load project: ${error.message}`);
    });
  
  // Setup form submission
  setupFormHandling();
  
  // Setup LLM provider toggles
  setupLLMProviderToggles();
  
  // Setup cancel button
  document.getElementById('btn-back-to-reports').addEventListener('click', () => {
    window.location.href = '/reports';
  });
}

/**
 * Fetch project data from API
 * @param {string} projectId - UUID of the project
 * @returns {Promise<Object>} Project data
 */
async function fetchProject(projectId) {
  try {
    // Prefer our authenticated API first
    const apiResp = await fetch(`/api/projects/${projectId}`);
    if (apiResp.ok) {
      const apiJson = await apiResp.json();
      if (apiJson && apiJson.success && apiJson.data) {
        console.log('[REPORT-GEN] Loaded project via /api/projects:', apiJson.data);
        return apiJson.data;
      }
      console.warn('[REPORT-GEN] /api/projects returned unexpected payload:', apiJson);
    } else {
      console.warn(`[REPORT-GEN] /api/projects/${projectId} failed with status`, apiResp.status);
    }

    // Fallback to PostgREST if available
    try {
      const pgrstResp = await fetch(`http://localhost:3010/projects?id=eq.${projectId}`, { headers: { Accept: 'application/json' } });
      if (!pgrstResp.ok) {
        throw new Error(`Failed to fetch project via PostgREST: ${pgrstResp.status}`);
      }
      const rows = await pgrstResp.json();
      const project = Array.isArray(rows) ? rows[0] : null;
      if (!project) throw new Error('Project not found');
      console.log('[REPORT-GEN] Loaded project via PostgREST:', project);
      return project;
    } catch (pgErr) {
      console.error('[REPORT-GEN] PostgREST fallback failed:', pgErr);
      throw pgErr;
    }
  } catch (error) {
    console.error('[REPORT-GEN] Error fetching project:', error);
    throw error;
  }
}

/**
 * Setup project information on the page
 * @param {Object} project - Project data
 */
function setupProjectInfo(project) {
  // Store project data globally
  projectData = project;
  
  // Update project name and description
  document.getElementById('project-name').textContent = project.name;
  document.getElementById('project-description').textContent = project.description || 'No description provided.';
  
  // Set default report title based on project name
  document.getElementById('report-title').value = `Security Assessment: ${project.name}`;

  // Populate read-only title display and hidden UUID field
  try {
    const titleDisplay = document.getElementById('project-title-display');
    const uuidInput = document.getElementById('project-uuid');
    if (titleDisplay) titleDisplay.value = project.name || '';
    const pid = project.uuid || project.id;
    if (uuidInput) uuidInput.value = pid;
    console.log('[REPORT-GEN] Project identifiers set', { name: titleDisplay?.value, projectId: pid });
  } catch (e) {
    console.warn('[REPORT-GEN] Failed setting project identifier fields', e);
  }
}

// Template selection now handled via modal that assigns #reportTemplateId and #reportTemplateName

/**
 * Setup LLM provider toggle behavior
 */
function setupLLMProviderToggles() {
  const openaiRadio = document.getElementById('provider-openai');
  const ollamaRadio = document.getElementById('provider-ollama');
  const openaiModels = document.getElementById('openai-models');
  const ollamaModels = document.getElementById('ollama-models');
  
  openaiRadio.addEventListener('change', () => {
    if (openaiRadio.checked) {
      openaiModels.classList.remove('d-none');
      ollamaModels.classList.add('d-none');
    }
  });
  
  ollamaRadio.addEventListener('change', () => {
    if (ollamaRadio.checked) {
      ollamaModels.classList.remove('d-none');
      openaiModels.classList.add('d-none');
    }
  });
}

/**
 * Setup form submission handling
 */
function setupFormHandling() {
  const form = document.getElementById('report-generator-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Disable submit button and show loading state
    const submitButton = document.getElementById('btn-generate-report');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
    
    try {
      // Get form values
      const formData = getFormData();
      
      // Generate report
      const report = await generateReport(formData);
      
      // Redirect to the new report page
      if (report && report.id) {
        window.location.href = `/reports/view/${report.id}`;
      } else {
        throw new Error('Failed to generate report: No report ID returned');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      showError(`Failed to generate report: ${error.message}`);
      
      // Reset button
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonText;
    }
  });
}

/**
 * Validate the report generator form
 * @returns {boolean} True if valid, false otherwise
 */
function validateForm() {
  // Check if project data is loaded
  if (!projectData) {
    showError('Project data is not loaded');
    return false;
  }
  
  // Check if template is selected via hidden input
  const chosenTemplateId = document.getElementById('reportTemplateId')?.value;
  if (!chosenTemplateId) {
    showError('Please select a report template');
    return false;
  }
  
  // Check if report title is provided
  const reportTitle = document.getElementById('report-title').value.trim();
  if (!reportTitle) {
    showError('Please enter a report title');
    return false;
  }
  
  return true;
}

/**
 * Get form data for report generation
 * @returns {Object} Form data
 */
function getFormData() {
  // Get selected provider and model
  const provider = document.querySelector('input[name="llm-provider"]:checked').value;
  let model = null;
  
  if (provider === 'openai') {
    model = document.getElementById('openai-model').value;
  } else if (provider === 'ollama') {
    model = document.getElementById('ollama-model').value;
  }
  
  // Get report title
  const reportTitle = document.getElementById('report-title').value.trim();

  // Selected template from inputs
  const templateId = document.getElementById('reportTemplateId')?.value;
  const templateName = document.getElementById('reportTemplateName')?.value || '';

  return {
    // Use hidden field as single source of truth for UUID to avoid exposing in UI
    projectId: document.getElementById('project-uuid')?.value || projectData.uuid || projectData.id,
    title: reportTitle,
    templateId,
    templateName,
    provider,
    model,
    sections: DEFAULT_SECTIONS
  };
}

/**
 * Generate report by calling the API
 * @param {Object} formData - Form data for report generation
 * @returns {Promise<Object>} Generated report
 */
async function generateReport(formData) {
  try {
    console.log('Generating report with data:', formData);
    
    // Call the API to generate report
    const response = await fetch('/api/report-generator/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Report generation result:', result);
    
    return result.report;
  } catch (error) {
    console.error('Error in generateReport:', error);
    throw error;
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  // Create alert if it doesn't exist
  showAlert(message, 'danger');
}

/**
 * Show success message
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
  showAlert(message, 'success');
}

/**
 * Show alert message
 * @param {string} message - Message to display
 * @param {string} type - Alert type (success, danger, etc.)
 */
function showAlert(message, type = 'info') {
  // Remove existing alerts
  document.querySelectorAll('.alert-dismissible').forEach(el => {
    if (!el.classList.contains('alert-info') || type !== 'info') {
      el.remove();
    }
  });
  
  // Create new alert
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Insert at top of container
  const container = document.querySelector('.generator-container');
  container.insertBefore(alert, container.firstChild.nextSibling);
  
  // Auto-dismiss after 5 seconds for non-error alerts
  if (type !== 'danger') {
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 5000);
  }
}
