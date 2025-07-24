// Vanilla JS Reports App - Vanilla JS Implementation

// Immediate script load verification
console.log('Reports app script loaded');

// Create a visual indicator that the script loaded
function createScriptLoadIndicator() {
  const indicator = document.createElement('div');
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.right = '10px';
  indicator.style.padding = '10px';
  indicator.style.background = 'green';
  indicator.style.color = 'white';
  indicator.style.zIndex = '9999';
  indicator.style.borderRadius = '5px';
  indicator.textContent = 'Reports script loaded';
  document.body.appendChild(indicator);
}

// Execute immediately
if (document.body) {
  createScriptLoadIndicator();
} else {
  window.addEventListener('DOMContentLoaded', createScriptLoadIndicator);
}

// No module dependencies, no JSX, no babel requirements

/**
 * Utility Functions for Reports Application
 */

// Show a message to the user (success, error, warning, info)
function showMessage(message, type = 'info') {
  // Remove any existing message
  const existingMessage = document.querySelector('.message-container');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Create message container
  const messageContainer = document.createElement('div');
  messageContainer.className = `message-container message-${type}`;
  
  // Create message content
  messageContainer.innerHTML = `
    <div class="alert alert-${type === 'error' ? 'danger' : type}" role="alert">
      ${message}
      <button type="button" class="btn-close" aria-label="Close" onclick="this.parentElement.parentElement.remove()"></button>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(messageContainer);
  
  // Auto-remove after 5 seconds unless it's an error
  if (type !== 'error') {
    setTimeout(() => {
      if (messageContainer.parentElement) {
        messageContainer.remove();
      }
    }, 5000);
  }
}

// Generic loading indicator management
function showLoader(message = 'Loading...', targetId = 'reports-content') {
  const container = document.getElementById(targetId);
  if (container) {
    container.innerHTML = `
      <div class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">${message}</p>
      </div>
    `;
  }
}

function hideLoader(targetId = 'reports-content') {
  // Do nothing special when hiding loader
  // Content will be replaced by whatever function called hideLoader
  console.log('Hiding loader in', targetId);
}

// Error handling
function handleApiError(error, title = 'Error', containerId = 'reports-content') {
  console.error(`${title}:`, error);
  
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <h4>${title}</h4>
        <p>${error.message || error}</p>
        <button class="btn btn-primary" onclick="fetchReports()">
          <i class="fas fa-arrow-left"></i> Back to Reports
        </button>
      </div>
    `;
  }
  
  showMessage(`${title}: ${error.message || error}`, 'error');
}

// createReportsApp function is defined at the end of this file (around line 1163)
// This eliminates the duplicate definition that was previously here

// Fetch projects from API
async function fetchProjects() {
  const contentContainer = document.getElementById('reports-content');
  
  try {
    // Show loading indicator
    contentContainer.innerHTML = `
      <div class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading projects...</p>
      </div>
    `;
    
    // Fetch projects directly from the API endpoint used by the main projects page
    const response = await fetch('/api/projects');
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    let responseData = await response.json();
    console.log('API response:', responseData);
    
    // Extract projects array from the response object
    let projects = [];
    if (responseData && responseData.success && Array.isArray(responseData.data)) {
      // Standard format: {success: true, data: [...projects]}
      projects = responseData.data;
    } else if (Array.isArray(responseData)) {
      // Direct array format
      projects = responseData;
    } else if (responseData && typeof responseData === 'object') {
      // Single project object format
      projects = [responseData];
    }
    
    console.log('Projects loaded:', projects);
    renderProjectsList(contentContainer, projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    contentContainer.innerHTML = `
      <div class="alert alert-danger">
        <h4>Error Loading Projects</h4>
        <p>${error.message}</p>
        <p>Please check that the API server is running and accessible.</p>
      </div>
    `;
  }
}

// Fetch reports from API
async function fetchReports() {
  console.log('DEBUG: fetchReports called');
  const contentContainer = document.getElementById('reports-content');
  console.log('DEBUG: contentContainer found:', contentContainer);
  
  try {
    // Show loading indicator
    contentContainer.innerHTML = `
      <div class="text-center my-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2">Loading reports...</p>
      </div>
    `;
    
    console.log('DEBUG: Attempting to fetch reports from http://localhost:3010/report');
    const response = await fetch('http://localhost:3010/report', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors', // Enable CORS mode
      credentials: 'same-origin' // Include credentials only for same origin
    });
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    console.log('DEBUG: API response received:', response);
    let reports = await response.json();
    console.log('DEBUG: Reports data:', reports);
    // Ensure reports is an array
    if (!Array.isArray(reports)) {
      console.warn('API response is not an array, converting to array:', reports);
      if (reports && typeof reports === 'object') {
        reports = [reports];
      } else {
        reports = [];
      }
    }
    console.log('DEBUG: About to render reports list with data:', reports);
    renderReportsList(contentContainer, reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    let errorMessage = error.message;
    if (errorMessage.includes('CORS') || errorMessage.includes('blocked by CORS policy')) {
      errorMessage += '\nThis may be a CORS policy issue. Check that the PostgREST server has appropriate CORS headers enabled.';
      console.error('CORS issue detected. Please make sure PostgREST has these headers:', {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
    }
    contentContainer.innerHTML = `
      <div class="alert alert-danger">
        <h4>Error Loading Reports</h4>
        <p>${errorMessage}</p>
        <p>Please check that the PostgREST server is running and accessible.</p>
        <button class="btn btn-sm btn-outline-secondary mt-2" onclick="fetchReports()">
          <i class="fas fa-sync"></i> Try Again
        </button>
        <div class="mt-3">
          <details>
            <summary>Debugging Information</summary>
            <pre class="bg-light p-2 mt-2" style="white-space: pre-wrap;">API URL: http://localhost:3010/report
Check network tab for more details</pre>
          </details>
        </div>
      </div>
    `;
  }
}

// Render the projects list as a DataTable
function renderProjectsList(container, projects) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Project List</h5>
        <button class="btn btn-sm btn-outline-secondary" onclick="fetchProjects()">
          <i class="fas fa-sync"></i> Refresh
        </button>
      </div>
      <div class="card-body">
        <table id="projectsTable" class="table table-striped table-hover" style="width:100%">
          <thead>
            <tr>
              <th>Name</th>
              <th>Business Unit</th>
              <th>Criticality</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="projects-tbody">
            <tr>
              <td colspan="5" class="text-center">Loading projects...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  let html = '';
  
  if (projects && projects.length > 0) {
    projects.forEach(project => {
      const criticalityBadgeClass = getCriticalityBadgeClass(project.criticality);
      const statusBadgeClass = getStatusBadgeClass(project.status);
      const projectName = project.name ? project.name.replace(/"/g, '&quot;') : 'Unnamed Project';
      
      html += `
        <tr>
          <td>${project.name || 'Unnamed Project'}</td>
          <td>${project.business_unit || '-'}</td>
          <td><span class="badge ${criticalityBadgeClass}">${project.criticality || 'Unknown'}</span></td>
          <td><span class="badge ${statusBadgeClass}">${project.status || 'Unknown'}</span></td>
          <td>
            <button class="btn btn-sm btn-primary" 
                    onclick="generateReport('${project.id}', '${projectName}')">
              <i class="fas fa-file-alt"></i> Generate Report
            </button>
          </td>
        </tr>
      `;
    });
  } else {
    html = `
      <tr>
        <td colspan="5" class="text-center">
          No projects found. Please create a project first.
        </td>
      </tr>
    `;
  }
  
  container.querySelector('#projects-tbody').innerHTML = html;
  
  // Initialize DataTable for better UI/sorting/filtering
  if ($.fn.DataTable) {
    try {
      if ($.fn.DataTable.isDataTable('#projectsTable')) {
        $('#projectsTable').DataTable().destroy();
      }
      
      $('#projectsTable').DataTable({
        responsive: true,
        pageLength: 10,
        language: {
          search: "Search:"
        }
      });
    } catch (error) {
      console.error('Error initializing DataTable:', error);
    }
  }
}

// Render the reports list
function renderReportsList(container, reports) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Generated Reports</h5>
        <div>
          <button class="btn btn-sm btn-success" onclick="createNewReport()">
            <i class="fas fa-plus"></i> New Report
          </button>
          <button class="btn btn-sm btn-outline-secondary" onclick="fetchReports()">
            <i class="fas fa-sync"></i> Refresh
          </button>
        </div>
      </div>
      <div class="card-body">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Title</th>
              <th>Created</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="reports-tbody">
            <tr>
              <td colspan="4" class="text-center">Loading reports...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  let html = '';
  
  if (reports && reports.length > 0) {
    reports.forEach(report => {
      const created = new Date(report.created_at).toLocaleDateString();
      const updated = new Date(report.updated_at).toLocaleDateString();
      
      html += `
        <tr>
          <td>${report.title || 'Untitled Report'}</td>
          <td>${created}</td>
          <td>${updated}</td>
          <td>
            <div class="btn-group" role="group">
              <button class="btn btn-sm btn-primary" onclick="viewReport(${report.id})">
                <i class="fas fa-eye"></i> View
              </button>
              <button class="btn btn-sm btn-secondary" onclick="editReport(${report.id})">
                <i class="fas fa-edit"></i> Edit
              </button>
            </div>
          </td>
        </tr>
      `;
    });
  } else {
    html = `
      <tr>
        <td colspan="4" class="text-center">
          No reports found. Generate a new report to get started.
        </td>
      </tr>
    `;
  }
  
  container.querySelector('#reports-tbody').innerHTML = html;
}

// Helper function to get appropriate badge class for criticality
function getCriticalityBadgeClass(criticality) {
  if (!criticality) return 'bg-secondary';
  
  switch (criticality.toLowerCase()) {
    case 'critical':
      return 'bg-danger';
    case 'high':
      return 'bg-warning text-dark';
    case 'medium':
      return 'bg-info text-dark';
    case 'low':
      return 'bg-success';
    default:
      return 'bg-secondary';
  }
}

// Helper function to get appropriate badge class for status
function getStatusBadgeClass(status) {
  if (!status) return 'bg-secondary';
  
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-success';
    case 'archived':
      return 'bg-secondary';
    case 'inactive':
      return 'bg-warning text-dark';
    default:
      return 'bg-info text-dark';
  }
}

// Create a new blank report or show project selection for a new report
async function createNewReport() {
  const contentContainer = document.getElementById('reports-content');
  
  // Show loading indicator
  contentContainer.innerHTML = `
    <div class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading projects...</p>
    </div>
  `;
  
  try {
    // Fetch available projects
    const projectsResponse = await fetch('/api/projects');
    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }
    
    let projects = await projectsResponse.json();
    
    // Ensure projects is an array (API might return object with projects property)
    if (projects && !Array.isArray(projects) && projects.projects) {
      projects = projects.projects;
    } else if (!Array.isArray(projects)) {
      console.error('Unexpected projects format:', projects);
      projects = Array.isArray(projects) ? projects : [];
    }
    
    console.log('Projects data:', projects);
    
    if (!projects || projects.length === 0) {
      contentContainer.innerHTML = `
        <div class="alert alert-warning" role="alert">
          <h4 class="alert-heading">No Projects Available</h4>
          <p>You need to create a project before you can generate a report.</p>
          <hr>
          <a href="/projects/new" class="btn btn-primary">Create New Project</a>
          <button class="btn btn-secondary ms-2" onclick="fetchReports()">Return to Reports</button>
        </div>
      `;
      return;
    }
    
    // Show project selection UI
    contentContainer.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Select a Project for Report</h5>
          <button class="btn btn-sm btn-outline-secondary" onclick="fetchReports()">
            <i class="fas fa-arrow-left"></i> Back to Reports
          </button>
        </div>
        <div class="card-body">
          <p class="text-muted">Select a project to generate a security report for:</p>
          <div class="table-responsive">
            <table class="table table-hover" id="projectsTable">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="projects-tbody">
                <!-- Projects will be rendered here -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    // Render projects into the table
    renderProjectsForReport(contentContainer, projects);
    
  } catch (error) {
    console.error('Error in createNewReport:', error);
    contentContainer.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <h4 class="alert-heading">Error</h4>
        <p>${error.message || 'Failed to load projects for report generation.'}</p>
        <hr>
        <button class="btn btn-primary" onclick="fetchReports()">Return to Reports</button>
      </div>
    `;
  }
}

// Render projects list specifically for report generation
function renderProjectsForReport(container, projects) {
  // Create the projects list content structure
  container.innerHTML = `
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Select Project for Report</h5>
        <button class="btn btn-sm btn-outline-secondary" onclick="fetchReports()">
          <i class="fas fa-arrow-left"></i> Back to Reports
        </button>
      </div>
      <div class="card-body">
        <p class="text-muted mb-3">Select a project to view or generate a security report:</p>
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Description</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="projects-list">
              <!-- Projects will be loaded here -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Get the table body where we'll add project rows
  const projectsList = container.querySelector('#projects-list');
  
  // Check if we have any projects
  if (!projects || projects.length === 0) {
    projectsList.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-3">
          <div class="alert alert-info mb-0">
            No projects found. Create a project first to generate reports.
            <br>
            <a href="/projects/new" class="btn btn-sm btn-primary mt-2">Create New Project</a>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  // Build table rows for each project
  let html = '';
  projects.forEach(project => {
    // Format date for better readability
    const created = new Date(project.created_at || project.created || Date.now()).toLocaleDateString();
    
    html += `
      <tr>
        <td>
          <strong>${escapeHtml(project.name)}</strong>
        </td>
        <td>${escapeHtml(project.description || 'No description')}</td>
        <td>${created}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <a href="/projects/${project.id}" class="btn btn-outline-secondary" title="View Project Details">
              <i class="fas fa-eye"></i> View
            </a>
            <button class="btn btn-primary" onclick="generateReport('${project.id}', '${escapeHtml(project.name)}')">
              <i class="fas fa-file-alt"></i> Generate
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  projectsList.innerHTML = html;
}

// Generate a report for a specific project - redirects to the generate page
function generateReport(projectId, projectName) {
  console.log(`Generating report for project: ${projectName} (ID: ${projectId})`);
  
  // Save the selected project info in localStorage for the generate page
  localStorage.setItem('selectedProjectId', projectId);
  localStorage.setItem('selectedProjectName', projectName);
  
  // Redirect to the generate page
  window.location.href = `/generate?projectId=${encodeURIComponent(projectId)}`;
}

// Render the report generation form
function renderReportGenerationForm(container, project, templates, threatModels) {
  const projectData = project.data || project;
  const projectName = projectData.name || 'Unnamed Project';
  const templateOptions = templates.map(template => 
    `<option value="${template.id}">${template.name}</option>`
  ).join('');
  
  container.innerHTML = `
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h5 class="mb-0">Generate Report for ${projectName}</h5>
        <button class="btn btn-outline-secondary" onclick="fetchProjects()">
          <i class="fas fa-arrow-left"></i> Back to Projects
        </button>
      </div>
      <div class="card-body">
        <form id="report-generation-form">
          <input type="hidden" id="project-id" value="${projectData.id}">
          
          <div class="mb-3">
            <label for="report-title" class="form-label">Report Title</label>
            <input type="text" class="form-control" id="report-title" 
                  value="Security Report - ${projectName}" required>
          </div>
          
          <div class="mb-3">
            <label for="template-select" class="form-label">Report Template</label>
            <select class="form-control" id="template-select" required>
              <option value="">-- Select a Template --</option>
              ${templateOptions}
            </select>
            <div class="form-text">Select a template for your report structure</div>
          </div>
          
          <div class="mb-3">
            <label for="llm-model" class="form-label">LLM Model</label>
            <select class="form-control" id="llm-model">
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </div>
          
          <div class="mb-3">
            <label class="form-label">Threat Models to Include</label>
            <div class="border rounded p-3" style="max-height: 200px; overflow-y: auto;">
              ${threatModels && threatModels.length > 0 ?
                threatModels.map(tm => `
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${tm.id}" 
                           id="tm-${tm.id}" name="threat-models" checked>
                    <label class="form-check-label" for="tm-${tm.id}">
                      ${tm.title || tm.name || 'Untitled Threat Model'}
                    </label>
                  </div>
                `).join('') :
                '<p class="text-muted">No threat models found for this project</p>'
              }
            </div>
          </div>
          
          <div class="mb-3">
            <label for="additional-instructions" class="form-label">Additional Instructions (Optional)</label>
            <textarea class="form-control" id="additional-instructions" 
                      rows="3" placeholder="Any specific focus areas or requirements for this report?"></textarea>
          </div>
          
          <div class="d-flex justify-content-end">
            <button type="button" class="btn btn-primary" onclick="processReportGeneration()">
              <i class="fas fa-magic"></i> Generate Report
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Process report generation - separate function outside of renderReportGenerationForm
async function processReportGeneration() {
  // Define a variable for contentContainer at the top level scope
  let contentContainer = null;
  
  try {
    // Get form values
    const projectId = document.getElementById('project-id').value;
    const reportTitle = document.getElementById('report-title').value;
    const templateId = document.getElementById('template-select').value;
    const llmModel = document.getElementById('llm-model').value;
    const additionalInstructions = document.getElementById('additional-instructions').value;

    // Get selected threat models
    const selectedThreatModels = [];
    document.querySelectorAll('#threat-models-select option:checked').forEach(option => {
      selectedThreatModels.push(option.value);
    });

    // Validate required inputs
    if (!projectId) {
      throw new Error('Please select a project');
    }

    if (!templateId) {
      throw new Error('Please select a template');
    }

    if (!reportTitle || reportTitle.trim() === '') {
      throw new Error('Please enter a report title');
    }

    // Using global utility functions for loader management
    showLoader('Generating report... This may take a moment.');

    // Get project data
    const projectResponse = await fetch(`/api/projects/${projectId}`);
    if (!projectResponse.ok) {
      throw new Error(`Failed to fetch project: ${projectResponse.status}`);
    }
    const projectData = await projectResponse.json();
  
    // Get threat model data if selected
    let threatModelData = [];
    if (selectedThreatModels.length > 0) {
      showLoader('Fetching threat model data...');
      const threatModelsResponse = await fetch(`/api/projects/${projectId}/threat-models`);
      if (threatModelsResponse.ok) {
        const allThreatModels = await threatModelsResponse.json();
        threatModelData = allThreatModels.filter(tm => selectedThreatModels.includes(tm.id));
      }
    }
  
    // Get template
    showLoader('Fetching report template...');
    const templateResponse = await fetch(`http://localhost:3010/template?id=eq.${templateId}`);
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateResponse.status}`);
    }
    const templates = await templateResponse.json();
    if (!templates || !templates.length) {
      throw new Error('No template found with the provided ID');
    }
    const template = templates[0];
  
    // Map template sections to our LLM section types
    const templateSections = template.sections || [];
    const sections = Array.isArray(templateSections) ? 
      templateSections.map((section, index) => ({
        title: section.title || `Section ${index + 1}`,
        content: 'Generating content...',
        order: index,
        type: mapSectionTypeToLLM(section.title || `Section ${index + 1}`)
      })) : [
        { title: 'Executive Overview', content: 'Generating content...', order: 0, type: 'overview' },
        { title: 'Key Threats', content: 'Generating content...', order: 1, type: 'threats' },
        { title: 'Mitigation Strategies', content: 'Generating content...', order: 2, type: 'mitigations' },
        { title: 'Recommendations', content: 'Generating content...', order: 3, type: 'recommendations' },
        { title: 'Appendix', content: 'Generating content...', order: 4, type: 'appendix' }
      ];
  
    // Prepare and send request to our context-aware report generator API
    showLoader('Generating context-aware report content... This may take some time.');
    
    const reportGenerationPayload = {
      projectId: projectId, // Keep as string to preserve UUID format
      sections: sections.map(s => s.type),
      provider: 'openai',
      model: llmModel
    };
    
    console.log('Sending context-aware report generation request:', JSON.stringify(reportGenerationPayload, null, 2));
    
    const generationResponse = await fetch('/api/report-generator/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportGenerationPayload)
    });
  
    if (!generationResponse.ok) {
      const errorText = await generationResponse.text().catch(() => 'No error details available');
      console.error(`Report generation error ${generationResponse.status}:`, errorText);
      throw new Error(`Failed to generate report: ${generationResponse.status} - ${errorText}`);
    }
    
    let generationResult;
    try {
      generationResult = await generationResponse.json();
      console.log('Context-aware report generation result:', generationResult);
    } catch (jsonError) {
      console.error('Failed to parse generation response as JSON:', jsonError);
      throw new Error('Failed to parse report generation response');
    }
    
    if (!generationResult.success) {
      throw new Error('Report generation failed: ' + (generationResult.error || 'Unknown error'));
    }
  
    // Update sections with generated content
    sections.forEach(section => {
      if (generationResult.sections && generationResult.sections[section.type]) {
        section.content = generationResult.sections[section.type];
      }
    });
  
    showLoader('Saving report to database...');
    
    // We now use UUIDs directly without mapping to integer IDs
    showLoader('Preparing report data...');
    
    // First, use the project mapper API to get the proper integer project ID mapping
    showLoader('Preparing report data...');
    const projectMapperResponse = await fetch(`/api/project-mapper/${projectId}`);
    
    if (!projectMapperResponse.ok) {
      const mapperError = await projectMapperResponse.text().catch(() => 'No error details available');
      throw new Error(`Failed to map project ID: ${projectMapperResponse.status} - ${mapperError}`);
    }
    
    let projectMapData;
    try {
      projectMapData = await projectMapperResponse.json();
    } catch (jsonError) {
      console.error('Failed to parse project mapper response as JSON:', jsonError);
      throw new Error('Failed to parse project ID mapping response');
    }
    
    if (!projectMapData.success) {
      throw new Error(`Project ID mapping failed: ${projectMapData.error || 'Unknown error'}`);
    }
  
    // Create the report in the database using both UUID and mapped integer ID
    const reportData = {
      title: reportTitle,
      project_id: projectMapData.projectId, // Use the mapped integer ID from our API
      project_uuid: projectId, // UUID foreign key to threat_model.projects
      template_id: parseInt(templateId, 10), // Template ID can remain numeric
      content: { sections: sections },       // Direct object - PostgREST will handle JSON conversion
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    showLoader('Creating report record...');
    console.log('Sending report creation request with payload:', JSON.stringify(reportData, null, 2));
    
    const createReportResponse = await fetch('http://localhost:3010/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    });
  
    if (!createReportResponse.ok) {
      const createError = await createReportResponse.text().catch(() => 'No error details available');
      throw new Error(`Failed to create report: ${createReportResponse.status} - ${createError}`);
    }
    
    let createResult;
    try {
      createResult = await createReportResponse.json();
      console.log('Report creation successful:', createResult);
    } catch (jsonError) {
      console.error('Failed to parse report creation response as JSON:', jsonError);
      throw new Error('Failed to parse report creation response');
    }
    
    // Store the newly created report for use in subsequent operations
    const newReport = createResult;
    
    if (!newReport || !Array.isArray(newReport) || newReport.length === 0) {
      throw new Error('Invalid report creation response format');
    }
    
    console.log('New report ID:', newReport[0].id);
  
    showLoader('Creating report sections...');
    
    // Create report sections
    for (const section of sections) {
      const sectionData = {
        report_id: newReport[0].id,
        title: section.title,
        content: section.content,
        order: section.order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const sectionResponse = await fetch('http://localhost:3010/content_section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sectionData)
      });
      
      if (!sectionResponse.ok) {
        console.warn(`Warning: Section ${section.title} creation failed: ${sectionResponse.status}`);
      }
    }
  
    showLoader('Creating revision history...');
    
    // Create initial revision
    const revisionData = {
      report_id: newReport[0].id,
      version: 1,
      content: JSON.stringify(sections),
      created_at: new Date().toISOString(),
      notes: 'Initial report generation'
    };
    
    const revisionResponse = await fetch('http://localhost:3010/report_revision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(revisionData)
    });
    
    if (!revisionResponse.ok) {
      console.warn(`Warning: Initial revision creation failed: ${revisionResponse.status}`);
    }
    
    // Show success message and provide navigation options
    hideLoader();
    contentContainer = document.getElementById('reports-content');
    if (contentContainer) {
      contentContainer.innerHTML = `
        <div class="alert alert-success">
          <h4>Report Generated Successfully!</h4>
          <p>Your report "${reportTitle}" has been created.</p>
          <div class="mt-3">
            <button class="btn btn-primary me-2" onclick="viewReport('${newReport[0].id}')">
              <i class="fas fa-eye"></i> View Report
            </button>
            <button class="btn btn-secondary" onclick="fetchReports()">
              <i class="fas fa-list"></i> Back to Reports
            </button>
          </div>
        </div>
      `;
      
      showMessage('Report generated and saved successfully!', 'success');
    } else {
      console.error('Content container not found when trying to show success message');
      showMessage('Report generated, but unable to display details.', 'warning');
    }
  } catch (error) {
    // Error handling
    console.error('Error during report generation:', error);
    hideLoader();
    showMessage(`Error: ${error.message}`, 'error');
    
    // Display error in the content area
    contentContainer = document.getElementById('reports-content');
    if (contentContainer) {
      contentContainer.innerHTML = `<div class="alert alert-danger">Failed to generate report: ${error.message}</div>`;
    } else {
      console.error('Content container not found when trying to show error message');
    }
  }
}

// Function to show the report generator interface (called from UI button)
function showReportGenerator() {
  console.log('Showing report generator...');
  // This function redirects to createNewReport which handles project selection
  createNewReport();
}

// Map section titles to specific LLM section types for context-aware report generation
function mapSectionTypeToLLM(sectionTitle) {
  // Convert to lowercase for case-insensitive matching
  const title = sectionTitle.toLowerCase();
  
  // Map common section titles to LLM section types
  if (title.includes('executive') || title.includes('overview') || title.includes('summary')) {
    return 'overview';
  } else if (title.includes('threat') || title.includes('vulnerabilit') || title.includes('risk')) {
    return 'threats';
  } else if (title.includes('mitigat') || title.includes('control') || title.includes('safeguard')) {
    return 'mitigations';
  } else if (title.includes('recommend') || title.includes('action') || title.includes('next step')) {
    return 'recommendations';
  } else if (title.includes('appendix') || title.includes('detail') || title.includes('reference')) {
    return 'appendix';
  } else if (title.includes('compliance') || title.includes('standard') || title.includes('regulation')) {
    return 'compliance';
  } else if (title.includes('impact') || title.includes('consequence') || title.includes('severity')) {
    return 'impact';
  } else if (title.includes('data flow') || title.includes('architecture') || title.includes('diagram')) {
    return 'architecture';
  } else if (title.includes('test') || title.includes('validat') || title.includes('assess')) {
    return 'testing';
  }
  
  // Default to 'general' if no specific match is found
  return 'general';
}

// Helper function to parse generated content into sections
function parseGeneratedContent(content, templateSections) {
  const sections = [];
  
  // Simple parsing logic - look for headings that match template sections
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line is a section header (using markdown-style headers)
    const headerMatch = line.match(/^#+\s+(.+)$/);
    if (headerMatch) {
      const headerText = headerMatch[1].trim();
      
      // If we were building a section, save it
      if (currentSection) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n'),
          order: sections.length
        });
      }
      
      // Start a new section
      currentSection = headerText;
      currentContent = [];
    } else if (currentSection) {
      // Add this line to the current section content
      currentContent.push(line);
    } else {
      // Before first section, create an introduction section
      if (line.trim() !== '') {
        if (!currentSection) {
          currentSection = 'Introduction';
        }
        currentContent.push(line);
      }
    }
  }
  
  // Don't forget the last section
  if (currentSection) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n'),
      order: sections.length
    });
  }
  
  // If we're missing any template sections, add them as empty
  if (templateSections && Array.isArray(templateSections)) {
    templateSections.forEach(section => {
      if (section && !sections.find(s => s.title.toLowerCase() === section.toLowerCase())) {
        sections.push({
          title: section,
          content: '_No content generated for this section._',
          order: sections.length
        });
      }
    });
  }
  
  return sections;
}

// View a report
function viewReport(reportId) {
  const contentContainer = document.getElementById('reports-content');
  
  // Show loading indicator
  contentContainer.innerHTML = `
    <div class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading report...</p>
    </div>
  `;
  
  // Fetch report details
  fetch(`http://localhost:3010/report?id=eq.${reportId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || data.length === 0) {
        throw new Error('Report not found');
      }
      
      const report = data[0];
      let sections = [];
      
      if (report.content && report.content.sections) {
        sections = report.content.sections;
      }
      
      contentContainer.innerHTML = `
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">${report.title || 'Untitled Report'}</h5>
            <div>
              <button class="btn btn-sm btn-primary" onclick="fetchReports()">
                <i class="fas fa-arrow-left"></i> Back to Reports
              </button>
              <button class="btn btn-sm btn-secondary" onclick="editReport(${report.id})">
                <i class="fas fa-edit"></i> Edit
              </button>
              <div class="dropdown d-inline-block">
                <button class="btn btn-sm btn-success dropdown-toggle" type="button" id="exportDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                  <i class="fas fa-download"></i> Export
                </button>
                <ul class="dropdown-menu" aria-labelledby="exportDropdown">
                  <li><a class="dropdown-item" href="#" onclick="exportReportAsPDF(${report.id}, '${report.title}')">PDF</a></li>
                  <li><a class="dropdown-item" href="#" onclick="exportReportAsMarkdown(${report.id}, '${report.title}')">Markdown</a></li>
                  <li><a class="dropdown-item" href="#" onclick="printReport(${report.id})">Print</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div class="card-body" id="report-content">
            <div id="report-sections">
      `;
      
      // Add each section
      sections.forEach(section => {
        contentContainer.querySelector('#report-sections').innerHTML += `
          <div class="mb-4">
            <h3>${section.title}</h3>
            <div class="report-section-content">
              ${section.content}
            </div>
          </div>
        `;
      });
      
      contentContainer.querySelector('#report-content').innerHTML += `
            </div>
          </div>
        </div>
      `;
    })
    .catch(error => {
      console.error('Error loading report:', error);
      contentContainer.innerHTML = `
        <div class="alert alert-danger">
          <h4>Error Loading Report</h4>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="fetchReports()">
            <i class="fas fa-arrow-left"></i> Back to Reports
          </button>
        </div>
      `;
    });
}

// Edit a report
function editReport(reportId) {
  const contentContainer = document.getElementById('reports-content');
  
  // Show loading indicator
  contentContainer.innerHTML = `
    <div class="text-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading report for editing...</p>
    </div>
  `;
  
  // Fetch report details
  fetch(`http://localhost:3010/report?id=eq.${reportId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || data.length === 0) {
        throw new Error('Report not found');
      }
      
      const report = data[0];
      let sections = [];
      
      if (report.content && report.content.sections) {
        sections = report.content.sections;
      }
      
      contentContainer.innerHTML = `
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Edit Report</h5>
            <div>
              <button class="btn btn-sm btn-success" onclick="saveReport(${report.id})">
                <i class="fas fa-save"></i> Save
              </button>
              <button class="btn btn-sm btn-secondary" onclick="viewReport(${report.id})">
                <i class="fas fa-times"></i> Cancel
              </button>
            </div>
          </div>
          <div class="card-body">
            <form id="report-edit-form">
              <input type="hidden" id="report-id" value="${report.id}">
              <div class="mb-3">
                <label for="report-title" class="form-label">Report Title</label>
                <input type="text" class="form-control" id="report-title" value="${report.title || ''}">
              </div>
              <div id="report-sections">
      `;
      
      // Add each section
      sections.forEach((section, index) => {
        contentContainer.querySelector('#report-sections').innerHTML += `
          <div class="card mb-3 report-section" data-index="${index}">
            <div class="card-header">
              <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Section ${index + 1}</h6>
                <button type="button" class="btn btn-sm btn-danger" onclick="removeSection(${index})">
                  <i class="fas fa-trash"></i> Remove
                </button>
              </div>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label class="form-label">Section Title</label>
                <input type="text" class="form-control section-title" value="${section.title || ''}">
              </div>
              <div class="mb-3">
                <label class="form-label">Content</label>
                <textarea class="form-control section-content" rows="8">${section.content || ''}</textarea>
              </div>
            </div>
          </div>
        `;
      });
      
      contentContainer.querySelector('#report-sections').innerHTML += `
              </div>
              <div class="mb-3">
                <button type="button" class="btn btn-success" onclick="addSection()">
                  <i class="fas fa-plus"></i> Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
    })
    .catch(error => {
      console.error('Error loading report for editing:', error);
      contentContainer.innerHTML = `
        <div class="alert alert-danger">
          <h4>Error Loading Report</h4>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="fetchReports()">
            <i class="fas fa-arrow-left"></i> Back to Reports
          </button>
        </div>
      `;
    });
}

// Add a new content section to the report editor
function addSection() {
  const sectionsContainer = document.getElementById('report-sections');
  const sectionCount = document.querySelectorAll('.report-section').length;
  
  const newSectionCard = document.createElement('div');
  newSectionCard.className = 'card mb-3 report-section';
  newSectionCard.dataset.index = sectionCount;
  
  newSectionCard.innerHTML = `
    <div class="card-header">
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="mb-0">Section ${sectionCount + 1}</h6>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeSection(${sectionCount})">
          <i class="fas fa-trash"></i> Remove
        </button>
      </div>
    </div>
    <div class="card-body">
      <div class="mb-3">
        <label class="form-label">Section Title</label>
        <input type="text" class="form-control section-title" value="">
      </div>
      <div class="mb-3">
        <label class="form-label">Content</label>
        <textarea class="form-control section-content" rows="8"></textarea>
      </div>
    </div>
  `;
  
  sectionsContainer.appendChild(newSectionCard);
}

// Remove a content section from the report editor
function removeSection(index) {
  document.querySelector(`.report-section[data-index="${index}"]`).remove();
}

// Save the edited report
function saveReport(reportId) {
  // Placeholder for save functionality
  alert(`Save functionality for report ${reportId} will be implemented here.`);
}

// Initialize the app when document is loaded

// Main application initialization function - expose to global scope for use in HTML
function createReportsApp() {
  console.log('DEBUG: Creating reports application - initialization starting...');
  const appContainer = document.getElementById('reports-app');
  
  if (!appContainer) {
    console.error('Reports app container not found');
    return;
  }
  
  // Create the main structure
  appContainer.innerHTML = `
    <div class="row">
      <div class="col-md-3">
        <div class="card mb-3">
          <div class="card-header bg-primary text-white">
            <h5 class="card-title mb-0">Reports</h5>
          </div>
          <div class="card-body">
            <div class="nav flex-column nav-pills" id="reports-nav">
              <button class="nav-link active" onclick="showReportsList()">All Reports</button>
              <button class="nav-link" onclick="showReportGenerator()">Generate New Report</button>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-9">
        <div id="reports-content" class="card">
          <div class="card-body">
            <div id="loader" style="display:none;" class="text-center">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p id="loader-message">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Initialize with reports list
  fetchReports();
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing vanilla JS reports app');
  console.log('DOM elements available:', {
    'reports-app': document.getElementById('reports-app'),
    'body': document.body
  });
  createReportsApp();
  // Force a direct call to make sure it executes
  setTimeout(() => {
    console.log('Forcing direct fetchReports call');
    fetchReports();
  }, 1000);
});

// Explicitly expose createReportsApp to the global scope
window.createReportsApp = createReportsApp;
