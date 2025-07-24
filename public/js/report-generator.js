/**
 * Report Generator JavaScript
 * Handles template selection, LLM provider settings, and report generation
 */

let projectData = null;
let selectedTemplateId = null;
let reportTemplates = [];

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
  
  // Load report templates
  loadReportTemplates();
  
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
    // Use PostgREST to avoid auth issues. Returns an array (0 or 1 rows)
    // Use explicit PostgREST port (3010). Adjust BASE_PGRST if proxy present.
    const response = await fetch(`http://localhost:3010/projects?id=eq.${projectId}`, { headers: { Accept: 'application/json' }});

    if (!response.ok) {
      throw new Error(`Failed to fetch project via PostgREST: ${response.status}`);
    }

    /**
     * PostgREST returns an array. Extract first item.
     * If no project is found, treat as error so UI shows message.
     */
    // Attempt to parse JSON; if this fails (e.g., HTML login page), fallback to authenticated API route
    let projects;
    try {
      projects = await response.json();
    } catch (parseErr) {
      console.warn('PostgREST returned non-JSON, falling back to /api/projects', parseErr);
      const fallbackResp = await fetch(`/api/projects/${projectId}`);
      if (!fallbackResp.ok) {
        throw new Error(`Fallback fetch failed: ${fallbackResp.status}`);
      }
      projects = [await fallbackResp.json()];
    }
    const project = Array.isArray(projects) && projects.length > 0 ? projects[0] : null;

    if (!project) {
      throw new Error('Project not found');
    }

    console.log('Project data (PostgREST):', project);
    return project;
  } catch (error) {
    console.error('Error fetching project:', error);
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
}

/**
 * Load and display report templates
 */
function loadReportTemplates() {
  // Get templates from hidden JSON
  try {
    const templatesData = document.getElementById('report-templates-data').textContent;
    reportTemplates = JSON.parse(templatesData);
    renderTemplates(reportTemplates);
  } catch (error) {
    console.error('Error loading templates:', error);
    showError('Failed to load report templates');
  }
}

/**
 * Render templates in the templates container
 * @param {Array} templates - Array of template objects
 */
function renderTemplates(templates) {
  const templatesContainer = document.getElementById('templates-container');
  templatesContainer.innerHTML = '';
  
  templates.forEach(template => {
    const templateCard = document.createElement('div');
    templateCard.className = 'col-md-4 mb-3';
    templateCard.innerHTML = `
      <div class="card template-card" data-template-id="${template.id}">
        <div class="card-body text-center">
          <div class="template-icon">
            <i class="fas ${template.icon}"></i>
          </div>
          <h5 class="card-title">${template.name}</h5>
          <p class="card-text">${template.description}</p>
        </div>
      </div>
    `;
    
    templatesContainer.appendChild(templateCard);
    
    // Add click handler for template selection
    templateCard.querySelector('.template-card').addEventListener('click', () => {
      selectTemplate(template);
    });
  });
  
  // Select first template by default
  if (templates.length > 0) {
    selectTemplate(templates[0]);
  }
}

/**
 * Select a template and update UI
 * @param {Object} template - Template object
 */
function selectTemplate(template) {
  // Store selected template ID
  selectedTemplateId = template.id;
  
  // Update UI for selected template
  document.querySelectorAll('.template-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  const selectedCard = document.querySelector(`.template-card[data-template-id="${template.id}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
  
  // Render section checkboxes for the selected template
  renderSectionCheckboxes(template);
}

/**
 * Render section checkboxes for the selected template
 * @param {Object} template - Template object
 */
function renderSectionCheckboxes(template) {
  const sectionsContainer = document.getElementById('report-sections');
  sectionsContainer.innerHTML = '';
  
  if (!template.sections || template.sections.length === 0) {
    sectionsContainer.innerHTML = '<div class="alert alert-warning">No sections defined for this template</div>';
    return;
  }
  
  template.sections.forEach(section => {
    const sectionCheck = document.createElement('div');
    sectionCheck.className = 'form-check';
    sectionCheck.innerHTML = `
      <input class="form-check-input" type="checkbox" id="section-${section.id}" 
             name="sections[]" value="${section.id}" ${section.default ? 'checked' : ''}>
      <label class="form-check-label" for="section-${section.id}">
        ${section.name}
      </label>
    `;
    
    sectionsContainer.appendChild(sectionCheck);
  });
}

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
  
  // Check if template is selected
  if (!selectedTemplateId) {
    showError('Please select a report template');
    return false;
  }
  
  // Check if report title is provided
  const reportTitle = document.getElementById('report-title').value.trim();
  if (!reportTitle) {
    showError('Please enter a report title');
    return false;
  }
  
  // Check if at least one section is selected
  const selectedSections = document.querySelectorAll('input[name="sections[]"]:checked');
  if (selectedSections.length === 0) {
    showError('Please select at least one report section');
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
  
  // Get selected sections
  const sectionElements = document.querySelectorAll('input[name="sections[]"]:checked');
  const sections = Array.from(sectionElements).map(el => el.value);
  
  // Get report title
  const reportTitle = document.getElementById('report-title').value.trim();
  
  // Find the selected template object
  const selectedTemplate = reportTemplates.find(t => t.id === selectedTemplateId);
  
  return {
    projectId: projectData.uuid || projectData.id,
    title: reportTitle,
    templateId: selectedTemplateId,
    templateName: selectedTemplate ? selectedTemplate.name : 'Custom Template',
    provider,
    model,
    sections
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
