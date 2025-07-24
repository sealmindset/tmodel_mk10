/**
 * Generate Report Page JavaScript
 * Handles LLM model and template selection, and report generation
 */

let projectData = null;
let templates = [];
let models = [];
let selectedTemplate = null;

/**
 * Initialize the generate page
 */
function initGeneratePage() {
  console.log('Initializing generate page...');
  
  // Get project ID from hidden input
  const projectId = document.getElementById('project-id').value;
  if (!projectId) {
    showError('No project ID provided. Please return to reports and select a project.');
    return;
  }
  
  // Fetch necessary data
  Promise.all([
    fetchProjectData(projectId),
    fetchTemplates(),
    fetchModels()
  ]).then(() => {
    // Setup form submission
    setupFormSubmission();
  }).catch(error => {
    showError(`Failed to initialize page: ${error.message}`);
  });
}

/**
 * Fetch project data from API
 */
async function fetchProjectData(projectId) {
  try {
    const response = await fetch(`/api/projects/${projectId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.status}`);
    }
    const raw = await response.json();
    // API may wrap data as {success, data}
    projectData = raw && raw.data ? raw.data : raw;
    console.log('Project data:', projectData);
    return projectData;
  } catch (error) {
    console.error('Error fetching project data:', error);
    showError(`Error fetching project data: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch available templates from PostgREST
 */
async function fetchTemplates() {
  try {
    const response = await fetch('http://localhost:3010/template', {
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors'
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`);
    }
    templates = await response.json();
    console.log('Templates:', templates);
    
    // Populate template select
    const templateSelect = document.getElementById('report-template');
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });
    
    // Setup template selection event
    templateSelect.addEventListener('change', (e) => {
      const selectedId = parseInt(e.target.value, 10);
      selectedTemplate = templates.find(t => t.id === selectedId);
      
      if (selectedTemplate) {
        const descContainer = document.getElementById('template-description');
        const descText = document.getElementById('template-desc-text');
        descText.textContent = selectedTemplate.description || 'No description available.';
        descContainer.classList.remove('d-none');
      }
    });
    
    return templates;
  } catch (error) {
    console.error('Error fetching templates:', error);
    showError(`Error fetching templates: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch available LLM models
 */
async function fetchModels() {
  try {
    // First try Ollama models
    let response = await fetch('/api/models/ollama');
    let data = await response.json();
    let ollamaModels = data.models || [];
    
    // Then try OpenAI models
    response = await fetch('/api/models/openai');
    data = await response.json();
    let openaiModels = data.models || [];
    
    // Combine models with provider prefix
    models = [
      ...ollamaModels.map(model => ({
        id: `ollama:${model}`,
        name: `Ollama: ${model}`,
        provider: 'ollama'
      })),
      ...openaiModels.map(model => ({
        id: `openai:${model}`,
        name: `OpenAI: ${model}`,
        provider: 'openai'
      }))
    ];
    
    // Populate model select
    const modelSelect = document.getElementById('llm-model');
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      modelSelect.appendChild(option);
    });
    
    return models;
  } catch (error) {
    console.error('Error fetching models:', error);
    showError(`Error fetching LLM models: ${error.message}`);
    throw error;
  }
}

/**
 * Setup form submission handler
 */
function setupFormSubmission() {
  const form = document.getElementById('report-generation-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const modelSelect = document.getElementById('llm-model');
    const templateSelect = document.getElementById('report-template');
    
    const modelValue = modelSelect.value;
    const templateId = templateSelect.value;
    
    if (!modelValue || !templateId) {
      showError('Please select both an LLM model and a report template.');
      return;
    }
    
    if (!projectData) {
      showError('Project data not loaded. Please refresh the page.');
      return;
    }
    
    // Show generation status
    const statusContainer = document.getElementById('generation-status');
    statusContainer.classList.remove('d-none');
    
    // Disable form
    form.querySelectorAll('select, button').forEach(el => {
      el.disabled = true;
    });
    
    try {
      await generateReport(modelValue, templateId, projectData);
    } catch (error) {
      console.error('Report generation failed:', error);
      showError(`Report generation failed: ${error.message}`);
      
      // Re-enable form
      form.querySelectorAll('select, button').forEach(el => {
        el.disabled = false;
      });
      
      // Hide status
      statusContainer.classList.add('d-none');
    }
  });
}

/**
 * Generate report using API
 */
async function generateReport(modelValue, templateId, project) {
  updateGenerationStatus('Starting report generation...', 5);
  
  // Extract provider and model name
  const [provider, modelName] = modelValue.split(':');
  
  // First, fetch the project's threat models
  updateGenerationStatus('Fetching project threat models...', 10);
  const threatModelsResponse = await fetch(`/api/projects/${project.id}/threat-models`);
  const threatModels = threatModelsResponse.ok ? await threatModelsResponse.json() : [];
  
  // Then fetch components and safeguards
  updateGenerationStatus('Fetching project components and safeguards...', 20);
  const componentsResponse = await fetch(`/api/projects/${project.id}/components`);
  const components = componentsResponse.ok ? await componentsResponse.json() : [];
  
  const safeguardsResponse = await fetch(`/api/projects/${project.id}/safeguards`);
  const safeguards = safeguardsResponse.ok ? await safeguardsResponse.json() : [];
  
  // Build full context object
  updateGenerationStatus('Preparing project context for LLM...', 30);
  const context = {
    project,
    components,
    safeguards,
    threatModels
  };
  
  // Initiate report generation
  updateGenerationStatus('Sending generation request to server...', 40);
  const response = await fetch('/api/report-generator/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: project.id || project.uuid || project.project_id,
      title: `Security Assessment: ${project.name || 'Untitled Project'}`,
      templateId: parseInt(templateId, 10),
      provider: provider,
      model: modelName,
      sections: ['overview','threats','vulnerabilities','mitigations','recommendations','appendix']
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate report');
  }
  
  updateGenerationStatus('Report successfully generated!', 80);
  
  // Get the generated report data
  const reportData = await response.json();
  
  // Save the report to the database
  updateGenerationStatus('Saving report to database...', 90);
  const saveResponse = await fetch('http://localhost:3010/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    mode: 'cors',
    body: JSON.stringify({
      title: `${project.name} Report`,
      content: reportData.content,
      project_id: parseInt(project.id, 10),  // Keep for backward compatibility
      project_uuid: project.uuid || project.id, // Use UUID if available
      template_id: parseInt(templateId, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  });
  
  if (!saveResponse.ok) {
    throw new Error('Failed to save report to database');
  }
  
  const savedReport = await saveResponse.json();
  
  // Complete! Redirect to view report page
  updateGenerationStatus('Report created! Redirecting...', 100);
  setTimeout(() => {
    window.location.href = `/viewrpt?id=${savedReport.id}`;
  }, 1000);
}

/**
 * Update generation status UI
 */
function updateGenerationStatus(message, progress) {
  const progressBar = document.getElementById('generation-progress');
  const messageElement = document.getElementById('generation-message');
  
  progressBar.style.width = `${progress}%`;
  progressBar.setAttribute('aria-valuenow', progress);
  progressBar.textContent = `${progress}%`;
  messageElement.textContent = message;
}

/**
 * Show error message
 */
function showError(message) {
  // Create alert if it doesn't exist
  let alert = document.querySelector('.alert-danger');
  if (!alert) {
    alert = document.createElement('div');
    alert.className = 'alert alert-danger mt-3';
    document.querySelector('.card-body').prepend(alert);
  }
  
  alert.textContent = message;
}
