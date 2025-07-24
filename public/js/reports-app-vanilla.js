// Vanilla JS Reports App
// No module dependencies, no JSX, no babel requirements

// Create a simple reports app component
function createReportsApp() {
  const container = document.getElementById('reports-app');
  if (!container) {
    console.error('Reports app container not found');
    return;
  }

  // Set initial HTML
  container.innerHTML = `
    <div class="container-fluid">
      <div class="row mb-4">
        <div class="col">
          <h1>Threat Model Reports</h1>
          <p class="lead">Select a project to generate a threat modeling report</p>
        </div>
      </div>
      
      <div class="row mb-4">
        <div class="col">
          <div class="btn-group" role="group">
            <button id="btn-projects" class="btn btn-primary">Projects</button>
            <button id="btn-reports" class="btn btn-outline-primary">Reports</button>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col" id="reports-content">
          <div class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading projects...</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Set up navigation buttons
  document.getElementById('btn-projects').addEventListener('click', () => {
    document.getElementById('btn-projects').classList.add('btn-primary');
    document.getElementById('btn-projects').classList.remove('btn-outline-primary');
    document.getElementById('btn-reports').classList.add('btn-outline-primary');
    document.getElementById('btn-reports').classList.remove('btn-primary');
    fetchProjects();
  });
  
  document.getElementById('btn-reports').addEventListener('click', () => {
    document.getElementById('btn-reports').classList.add('btn-primary');
    document.getElementById('btn-reports').classList.remove('btn-outline-primary');
    document.getElementById('btn-projects').classList.add('btn-outline-primary');
    document.getElementById('btn-projects').classList.remove('btn-primary');
    fetchReports();
  });

  // Fetch projects by default
  fetchProjects();
}

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
    
    const response = await fetch('/api/projects');
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const projects = await response.json();
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

// Render the projects list as a DataTable
function renderProjectsList(container, projects) {
  let html = `
    <div class="card">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Available Projects</h5>
          <div>
            <button class="btn btn-sm btn-success" onclick="createNewReport()">
              <i class="fas fa-plus"></i> Create New Report
            </button>
          </div>
        </div>
      </div>
      <div class="card-body">
  `;
  
  if (projects.length === 0) {
    html += `<p>No projects found. Please create projects in the main application.</p>`;
  } else {
    html += `
      <div class="table-responsive">
        <table class="table table-striped table-hover" id="projects-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Business Unit</th>
              <th>Criticality</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    projects.forEach(project => {
      html += `
        <tr>
          <td>${project.name || 'Unnamed Project'}</td>
          <td>${project.business_unit || 'N/A'}</td>
          <td><span class="badge ${getCriticalityBadgeClass(project.criticality)}">${project.criticality || 'N/A'}</span></td>
          <td><span class="badge ${getStatusBadgeClass(project.status)}">${project.status || 'N/A'}</span></td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="generateReport(${project.id}, '${encodeURIComponent(project.name)}')">
              <i class="fas fa-file-alt"></i> Generate Report
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
  }
  
  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Initialize DataTable if available
  if (typeof $.fn.DataTable !== 'undefined') {
    $('#projects-table').DataTable({
      responsive: true,
      pageLength: 10,
      lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]]
    });
  }
}

// Helper function to get appropriate badge class for criticality
function getCriticalityBadgeClass(criticality) {
  if (!criticality) return 'bg-secondary';
  
  switch(criticality.toLowerCase()) {
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
  
  switch(status.toLowerCase()) {
    case 'active':
      return 'bg-success';
    case 'archived':
      return 'bg-secondary';
    case 'draft':
      return 'bg-info text-dark';
    case 'completed':
      return 'bg-primary';
    default:
      return 'bg-secondary';
  }
}

// Fetch reports from API
async function fetchReports() {
  const contentContainer = document.getElementById('reports-content');
  
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
    
    const response = await fetch('http://localhost:3010/report');
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const reports = await response.json();
    renderReportsList(contentContainer, reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    contentContainer.innerHTML = `
      <div class="alert alert-danger">
        <h4>Error Loading Reports</h4>
        <p>${error.message}</p>
        <p>Please check that PostgREST is running and the API is accessible.</p>
      </div>
    `;
  }
}

// Render the reports list
function renderReportsList(container, reports) {
  let html = `
    <div class="card">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Available Reports</h5>
          <div>
            <button class="btn btn-sm btn-primary" onclick="fetchProjects()">
              <i class="fas fa-plus"></i> Generate New Report
            </button>
          </div>
        </div>
      </div>
      <div class="card-body">
  `;
  
  if (reports.length === 0) {
    html += `<p>No reports found. Create a new report to get started.</p>`;
  } else {
    html += `
      <div class="table-responsive">
        <table class="table table-striped table-hover" id="reports-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    reports.forEach(report => {
      const createdDate = new Date(report.created_at).toLocaleString();
      html += `
        <tr>
          <td>${report.title || 'Untitled Report'}</td>
          <td>${createdDate}</td>
          <td>
            <button class="btn btn-sm btn-primary me-2" onclick="viewReport(${report.id})">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-sm btn-secondary" onclick="editReport(${report.id})">
              <i class="fas fa-edit"></i> Edit
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
      </div>
    `;
  }
  
  html += `
      </div>
    </div>
  `;
  
  // Set the HTML to the container
  container.innerHTML = html;
  
  // Initialize DataTable if available
  if (typeof $.fn.DataTable !== 'undefined') {
    $('#reports-table').DataTable({
      responsive: true,
      pageLength: 10,
      lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]]
    });
  }
}

// View a report
async function viewReport(reportId) {
  try {
    // Show loading indicator
    const container = document.getElementById('reports-app');
    container.innerHTML = `
      <div class="container-fluid">
        <div class="row mb-4">
          <div class="col">
            <h1>View Report</h1>
            <button class="btn btn-outline-secondary" onclick="createReportsApp()">
              <i class="fas fa-arrow-left"></i> Back to Reports
            </button>
          </div>
        </div>
        
        <div class="row">
          <div class="col" id="report-view">
            <div class="text-center my-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2">Loading report...</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Fetch the report data
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const reports = await response.json();
    if (reports.length === 0) {
      throw new Error(`Report with ID ${reportId} not found`);
    }
    
    const report = reports[0];
    const viewContainer = document.getElementById('report-view');
    
    // Render the report
    let contentHtml = '';
    
    // If we have content sections, render each one
    if (report.content && report.content.sections) {
      report.content.sections.forEach(section => {
        contentHtml += `
          <div class="card mb-4">
            <div class="card-header">
              <h3>${section.title}</h3>
            </div>
            <div class="card-body markdown-preview">
              ${marked.parse(section.content)}
            </div>
          </div>
        `;
      });
    } else {
      contentHtml = '<div class="alert alert-info">This report has no content sections.</div>';
    }
    
    viewContainer.innerHTML = `
      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          <h2>${report.title}</h2>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}<br>
            <strong>Last Updated:</strong> ${new Date(report.updated_at).toLocaleString()}<br>
            <strong>Project ID:</strong> ${report.project_id}<br>
            <strong>Template ID:</strong> ${report.template_id || 'Default'}
          </div>
          
          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn btn-secondary" onclick="editReport(${report.id})">
              <i class="fas fa-edit"></i> Edit This Report
            </button>
            
            <div class="dropdown">
              <button class="btn btn-success dropdown-toggle" type="button" id="exportDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fas fa-download"></i> Export Report
              </button>
              <ul class="dropdown-menu" aria-labelledby="exportDropdown">
                <li><a class="dropdown-item" href="#" onclick="exportReportAsPDF(${report.id})">Export as PDF</a></li>
                <li><a class="dropdown-item" href="#" onclick="exportReportAsMarkdown(${report.id})">Export as Markdown</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item" href="#" onclick="printReport(${report.id})">Print Report</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <h3>Report Content</h3>
      ${contentHtml}
    `;
    
    // Initialize Bootstrap dropdowns if available
    if (typeof bootstrap !== 'undefined') {
      const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
      dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
      });
    }
    
  } catch (error) {
    console.error('Error viewing report:', error);
    document.getElementById('report-view').innerHTML = `
      <div class="alert alert-danger">
        <h4>Error Loading Report</h4>
        <p>${error.message}</p>
        <button class="btn btn-primary mt-2" onclick="createReportsApp()">
          Back to Reports List
        </button>
      </div>
    `;
  }
}

// Edit a report
async function editReport(reportId) {
  try {
    // Show loading indicator
    const container = document.getElementById('reports-app');
    container.innerHTML = `
      <div class="container-fluid">
        <div class="row mb-4">
          <div class="col">
            <h1>Edit Report</h1>
            <button class="btn btn-outline-secondary" onclick="createReportsApp()">
              <i class="fas fa-arrow-left"></i> Back to Reports
            </button>
          </div>
        </div>
        
        <div class="row">
          <div class="col" id="report-edit">
            <div class="text-center my-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2">Loading report editor...</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Fetch the report data
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const reports = await response.json();
    if (reports.length === 0) {
      throw new Error(`Report with ID ${reportId} not found`);
    }
    
    const report = reports[0];
    const editContainer = document.getElementById('report-edit');
    
    // Prepare sections HTML
    let sectionsHtml = '';
    
    // If the report has content sections, create edit fields for each
    if (report.content && report.content.sections) {
      report.content.sections.forEach((section, index) => {
        sectionsHtml += `
          <div class="card mb-4 content-section" data-section-index="${index}">
            <div class="card-header">
              <div class="mb-3">
                <label for="section-title-${index}" class="form-label">Section Title</label>
                <input type="text" class="form-control section-title" 
                  id="section-title-${index}" value="${section.title}">
              </div>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="section-content-${index}" class="form-label">Section Content (Markdown)</label>
                <textarea class="form-control section-content" id="section-content-${index}" 
                  rows="6">${section.content}</textarea>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Preview</label>
                <div class="card">
                  <div class="card-body markdown-preview" id="preview-${index}">
                    ${marked.parse(section.content)}
                  </div>
                </div>
              </div>
              
              <button type="button" class="btn btn-danger btn-sm remove-section-btn"
                onclick="removeSection(${index})">
                <i class="fas fa-trash"></i> Remove Section
              </button>
            </div>
          </div>
        `;
      });
    }
    
    // Render the edit form
    editContainer.innerHTML = `
      <form id="report-edit-form">
        <input type="hidden" id="report-id" value="${report.id}">
        
        <div class="card mb-4">
          <div class="card-header bg-primary text-white">
            <h2>Edit Report</h2>
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label for="report-title" class="form-label">Report Title</label>
              <input type="text" class="form-control" id="report-title" value="${report.title}" required>
            </div>
            
            <div class="mb-3">
              <strong>Created:</strong> ${new Date(report.created_at).toLocaleString()}<br>
              <strong>Last Updated:</strong> ${new Date(report.updated_at).toLocaleString()}<br>
              <strong>Project ID:</strong> ${report.project_id}<br>
              <strong>Template ID:</strong> ${report.template_id}
            </div>
          </div>
        </div>
        
        <h3>Report Sections</h3>
        <div id="content-sections">
          ${sectionsHtml}
        </div>
        
        <div class="mb-4">
          <button type="button" class="btn btn-success" id="add-section-btn" onclick="addSection()">
            <i class="fas fa-plus"></i> Add New Section
          </button>
        </div>
        
        <div class="mb-4">
          <button type="button" class="btn btn-primary" id="save-report-btn" onclick="saveReport()">
            <i class="fas fa-save"></i> Save Report
          </button>
          <button type="button" class="btn btn-secondary ms-2" onclick="viewReport(${report.id})">
            <i class="fas fa-eye"></i> View Report
          </button>
        </div>
      </form>
    `;
    
    // Add event listeners for live preview on all textareas
    document.querySelectorAll('.section-content').forEach((textarea, index) => {
      textarea.addEventListener('input', function() {
        document.getElementById(`preview-${index}`).innerHTML = marked.parse(this.value);
      });
    });
    
  } catch (error) {
    console.error('Error editing report:', error);
    document.getElementById('report-edit').innerHTML = `
      <div class="alert alert-danger">
        <h4>Error Loading Report Editor</h4>
        <p>${error.message}</p>
        <button class="btn btn-primary mt-2" onclick="createReportsApp()">
          Back to Reports List
        </button>
      </div>
    `;
  }
}

// Add a new content section to the report editor
function addSection() {
  const contentSections = document.getElementById('content-sections');
  const sectionIndex = document.querySelectorAll('.content-section').length;
  
  const newSectionHtml = `
    <div class="card mb-4 content-section" data-section-index="${sectionIndex}">
      <div class="card-header">
        <div class="mb-3">
          <label for="section-title-${sectionIndex}" class="form-label">Section Title</label>
          <input type="text" class="form-control section-title" 
            id="section-title-${sectionIndex}" value="New Section">
        </div>
      </div>
      <div class="card-body">
        <div class="mb-3">
          <label for="section-content-${sectionIndex}" class="form-label">Section Content (Markdown)</label>
          <textarea class="form-control section-content" id="section-content-${sectionIndex}" 
            rows="6">Enter content here...</textarea>
        </div>
        
        <div class="mb-3">
          <label class="form-label">Preview</label>
          <div class="card">
            <div class="card-body markdown-preview" id="preview-${sectionIndex}">
              <p>Enter content here...</p>
            </div>
          </div>
        </div>
        
        <button type="button" class="btn btn-danger btn-sm remove-section-btn"
          onclick="removeSection(${sectionIndex})">
          <i class="fas fa-trash"></i> Remove Section
        </button>
      </div>
    </div>
  `;
  
  // Append the new section to the container
  contentSections.insertAdjacentHTML('beforeend', newSectionHtml);
  
  // Add event listener for live preview
  const textarea = document.getElementById(`section-content-${sectionIndex}`);
  textarea.addEventListener('input', function() {
    document.getElementById(`preview-${sectionIndex}`).innerHTML = marked.parse(this.value);
  });
  
  // Focus on the new section title
  document.getElementById(`section-title-${sectionIndex}`).focus();
}

// Remove a content section from the report editor
function removeSection(index) {
  const section = document.querySelector(`.content-section[data-section-index="${index}"]`);
  if (section && confirm('Are you sure you want to remove this section?')) {
    section.remove();
  }
}

// Create a new blank report without a specific project
function createNewReport() {
  // Navigate to the report generator without a specific project
  generateReport(null, null);
}

// Generate a report for a specific project
function generateReport(projectId, projectName) {
  const container = document.getElementById('reports-app');
  
  // Decode project name if provided
  const decodedProjectName = projectName ? decodeURIComponent(projectName) : null;
  
  container.innerHTML = `
    <div class="container-fluid">
      <div class="row mb-4">
        <div class="col">
          <h1>Generate Report</h1>
          <button class="btn btn-outline-secondary" onclick="createReportsApp()">
            <i class="fas fa-arrow-left"></i> Back to Projects
          </button>
        </div>
      </div>
      
      <div class="row">
        <div class="col" id="report-generator">
          <div class="card">
            <div class="card-header">
              <h5>Report Generator</h5>
            </div>
            <div class="card-body">
              <form id="report-generator-form">
                <div class="mb-3">
                  <label for="project-selection" class="form-label">System to Analyze</label>
                  ${projectId ? 
                    `<input type="text" class="form-control" id="project-name" value="${decodedProjectName}" readonly>` :
                    `<select class="form-select" id="project-selection" required>
                      <option value="" selected disabled>Select a project</option>
                      <option value="loading">Loading projects...</option>
                    </select>`
                  }
                  <input type="hidden" id="project-id" value="${projectId || ''}">
                </div>
                
                <div class="mb-3">
                  <label for="llm-selection" class="form-label">Select LLM for Report Generation</label>
                  <select class="form-select" id="llm-selection" required>
                    <option value="" selected disabled>Select LLM Provider</option>
                    <option value="openai">OpenAI</option>
                    <option value="ollama">Ollama</option>
                  </select>
                </div>
                
                <div id="llm-model-container" class="mb-3 d-none">
                  <label for="llm-model" class="form-label">Select Model</label>
                  <select class="form-select" id="llm-model" required>
                    <option value="" selected disabled>Select Model</option>
                  </select>
                </div>
                
                <div class="mb-3">
                  <label for="template-selection" class="form-label">Report Template</label>
                  <select class="form-select" id="template-selection" required>
                    <option value="" selected disabled>Select Template</option>
                    <option value="loading">Loading templates...</option>
                  </select>
                </div>
                
                <div class="mb-3">
                  <label for="report-title" class="form-label">Report Title</label>
                  <input type="text" class="form-control" id="report-title" value="${decodedProjectName ? `${decodedProjectName} Security Report` : 'New Security Report'}">
                </div>
                
                <button type="button" class="btn btn-primary" id="generate-btn" onclick="processReportGeneration()">
                  <i class="fas fa-cog"></i> Generate Report
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Load necessary data
  loadReportGenerationDependencies(projectId);
}

// Load templates and other dependencies for report generation
async function loadReportGenerationDependencies(projectId) {
  // If no project is selected, load available projects
  if (!projectId) {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error(`Failed to fetch projects: ${response.status}`);
      
      const projects = await response.json();
      const projectSelect = document.getElementById('project-selection');
      projectSelect.innerHTML = '<option value="" selected disabled>Select a project</option>';
      
      projects.forEach(project => {
        projectSelect.innerHTML += `<option value="${project.id}">${project.name}</option>`;
      });
    } catch (error) {
      console.error('Error loading projects:', error);
      document.getElementById('project-selection').innerHTML = 
        `<option value="" selected disabled>Error loading projects</option>`;
    }
  }
  
  // Load templates from PostgREST API
  try {
    const response = await fetch('http://localhost:3010/template');
    if (!response.ok) throw new Error(`Failed to fetch templates: ${response.status}`);
    
    const templates = await response.json();
    const templateSelect = document.getElementById('template-selection');
    templateSelect.innerHTML = '<option value="" selected disabled>Select Template</option>';
    
    if (templates.length === 0) {
      templateSelect.innerHTML += '<option value="default">Default Template</option>';
    } else {
      templates.forEach(template => {
        templateSelect.innerHTML += `<option value="${template.id}">${template.name}</option>`;
      });
    }
  } catch (error) {
    console.error('Error loading templates:', error);
    document.getElementById('template-selection').innerHTML = 
      `<option value="default">Default Template</option>`;
  }
  
  // Set up LLM model change handler
  const llmSelection = document.getElementById('llm-selection');
  llmSelection.addEventListener('change', async function() {
    const modelContainer = document.getElementById('llm-model-container');
    const modelSelect = document.getElementById('llm-model');
    
    // Clear previous models
    modelSelect.innerHTML = '<option value="" selected disabled>Select Model</option>';
    
    if (this.value === 'openai') {
      modelContainer.classList.remove('d-none');
      modelSelect.innerHTML += `
        <option value="gpt-4o">GPT-4o</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
      `;
    } else if (this.value === 'ollama') {
      modelContainer.classList.remove('d-none');
      
      // Fetch Ollama models
      try {
        const response = await fetch('/api/ollama/models');
        if (!response.ok) throw new Error(`Failed to fetch Ollama models: ${response.status}`);
        
        const models = await response.json();
        if (Array.isArray(models) && models.length > 0) {
          models.forEach(model => {
            modelSelect.innerHTML += `<option value="${model.name}">${model.name}</option>`;
          });
        } else {
          modelSelect.innerHTML += `<option value="llama3">Llama3</option>`;
        }
      } catch (error) {
        console.error('Error fetching Ollama models:', error);
        modelSelect.innerHTML += `
          <option value="llama3">Llama3</option>
          <option value="codellama">CodeLlama</option>
        `;
      }
    } else {
      modelContainer.classList.add('d-none');
    }
  });
}

// Process the report generation request
async function processReportGeneration() {
  const generateBtn = document.getElementById('generate-btn');
  generateBtn.disabled = true;
  generateBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...`;
  
  try {
    // Get form values
    const projectId = document.getElementById('project-id').value || 
                     (document.getElementById('project-selection')?.value || '');
    
    const reportTitle = document.getElementById('report-title').value;
    const llmProvider = document.getElementById('llm-selection').value;
    const llmModel = document.getElementById('llm-model').value;
    const templateId = document.getElementById('template-selection').value;
    
    // Validate form
    if (!projectId) {
      throw new Error('Please select a project');
    }
    
    if (!llmProvider) {
      throw new Error('Please select an LLM provider');
    }
    
    if (llmProvider && !llmModel && document.getElementById('llm-model-container').classList.contains('d-none') === false) {
      throw new Error('Please select an LLM model');
    }
    
    // Get template content
    let templateContent = null;
    if (templateId === 'default') {
      templateContent = {
        sections: [
          { title: 'Executive Summary', content: 'This report provides an overview of the security assessment...' },
          { title: 'Threat Analysis', content: 'The following threats were identified...' },
          { title: 'Recommendations', content: 'Based on our findings, we recommend...' }
        ]
      };
    } else if (templateId) {
      // Fetch template from API
      try {
        const templateResponse = await fetch(`http://localhost:3010/template?id=eq.${templateId}`);
        if (!templateResponse.ok) throw new Error(`Template fetch failed: ${templateResponse.status}`);
        
        const templates = await templateResponse.json();
        if (templates.length > 0) {
          templateContent = templates[0].content;
        }
      } catch (templateError) {
        console.error('Error fetching template:', templateError);
        throw new Error(`Failed to load template: ${templateError.message}`);
      }
    }
    
    // Generate content with LLM API
    const reportContainer = document.getElementById('report-generator');
    reportContainer.innerHTML = `
      <div class="alert alert-info">
        <div class="d-flex align-items-center">
          <div class="spinner-border spinner-border-sm me-2" role="status">
            <span class="visually-hidden">Generating report...</span>
          </div>
          <div>
            <h5 class="mb-1">Generating Report</h5>
            <p class="mb-0">Using ${llmProvider} ${llmModel || ''}. This may take a moment...</p>
          </div>
        </div>
      </div>
    `;
    
    // Fetch project details to enhance the LLM prompt with context
    let projectDetails = null;
    try {
      const projectResponse = await fetch(`/api/projects?projectId=${projectId}`);
      if (projectResponse.ok) {
        const projects = await projectResponse.json();
        if (projects && projects.length > 0) {
          projectDetails = projects[0];
        }
      }
    } catch (projectError) {
      console.warn('Could not fetch detailed project info:', projectError);
      // Continue with limited context if project details can't be fetched
    }
    
    // Fetch threat model data related to this project to provide to the LLM
    let threatModelData = null;
    try {
      const threatModelResponse = await fetch(`/api/threat-models?projectId=${projectId}`);
      if (threatModelResponse.ok) {
        threatModelData = await threatModelResponse.json();
      }
    } catch (threatModelError) {
      console.warn('Could not fetch threat model data:', threatModelError);
      // Continue without threat model data
    }
    
    // Build an enhanced prompt with project details if available
    let enhancedPrompt = `Generate a comprehensive security report for the project`;
    
    if (projectDetails) {
      enhancedPrompt += ` "${projectDetails.name}".

Project Details:
- Business Unit: ${projectDetails.business_unit || 'Not specified'}
- Criticality: ${projectDetails.criticality || 'Not specified'}
- Status: ${projectDetails.status || 'Active'}
- Environment: ${projectDetails.environment || 'Not specified'}
- Technology: ${projectDetails.technology || 'Not specified'}`;
    } else {
      enhancedPrompt += ` with ID ${projectId}.`;
    }
    
    // Add threat model data to the prompt if available
    if (threatModelData && Array.isArray(threatModelData) && threatModelData.length > 0) {
      enhancedPrompt += `

Existing Threat Model Information:
`;
      
      // Include up to 5 threat models to avoid making the prompt too long
      const limitedThreats = threatModelData.slice(0, 5);
      
      limitedThreats.forEach((threat, index) => {
        enhancedPrompt += `
Threat ${index + 1}:
- Title: ${threat.title || 'Unknown'}
- Description: ${threat.description || 'No description'}
- Severity: ${threat.severity || 'Unknown'}
- Status: ${threat.status || 'Unknown'}
`;
      });
      
      if (threatModelData.length > 5) {
        enhancedPrompt += `
(${threatModelData.length - 5} additional threats not shown for brevity)
`;
      }
    }
    
    enhancedPrompt += `

The report should include:
1. Executive Summary - A high-level overview of the project security posture
2. Threat Analysis - Key threats and vulnerabilities identified (incorporate the existing threat model data provided)
3. Risk Assessment - Evaluation of risks based on project criticality
4. Recommendations - Prioritized security improvements
5. Conclusion - Summary of findings and next steps

For each section, provide specific, actionable insights relevant to this project. Make sure to reference the existing threat model data in your analysis.`;
    
    // Request to generate content via LLM
    const generateRequest = {
      provider: llmProvider,
      model: llmModel || '',
      prompt: enhancedPrompt,
      temperature: 0.7,
      max_tokens: 2500
    };
    
    // Call LLM API to generate content
    const llmResponse = await fetch('/api/llm/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generateRequest)
    });
    
    if (!llmResponse.ok) {
      throw new Error(`LLM API failed with status ${llmResponse.status}`);
    }
    
    const llmResult = await llmResponse.json();
    const generatedText = llmResult.response || '';
    
    // Create report structure from template and generated content
    let reportSections = [];
    
    if (templateContent && Array.isArray(templateContent.sections)) {
      reportSections = templateContent.sections.map(section => {
        return {
          title: section.title,
          content: section.content + '\n\n' + generatedText
        };
      });
    } else {
      // Create default sections if no template
      reportSections = [
        { title: 'Executive Summary', content: generatedText.substring(0, 500) + '...' },
        { title: 'Threat Analysis', content: generatedText.substring(500, 1500) + '...' },
        { title: 'Recommendations', content: generatedText.substring(1500) }
      ];
    }
    
    // Save the new report to the database
    const newReport = {
      project_id: parseInt(projectId),
      title: reportTitle,
      content: {
        sections: reportSections
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const saveResponse = await fetch('http://localhost:3010/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newReport)
    });
    
    if (!saveResponse.ok) {
      throw new Error(`Failed to save report: ${saveResponse.status}`);
    }
    
    const savedReport = await saveResponse.json();
    
    // Show success and view the new report
    reportContainer.innerHTML = `
      <div class="alert alert-success">
        <h5>Report Generated Successfully!</h5>
        <p>Your report has been created and saved.</p>
        <div class="mt-3">
          <button class="btn btn-primary me-2" onclick="viewReport(${savedReport[0].id})">
            <i class="fas fa-eye"></i> View Report
          </button>
          <button class="btn btn-secondary" onclick="editReport(${savedReport[0].id})">
            <i class="fas fa-edit"></i> Edit Report
          </button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Report generation error:', error);
    
    // Re-enable button
    generateBtn.disabled = false;
    generateBtn.innerHTML = `<i class="fas fa-cog"></i> Generate Report`;
    
    // Show error
    const errorContainer = document.getElementById('report-generator');
    errorContainer.insertAdjacentHTML('afterbegin', `
      <div class="alert alert-danger alert-dismissible fade show" role="alert">
        <h5>Report Generation Failed</h5>
        <p>${error.message}</p>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `);
  }
}

// Save the edited report
async function saveReport() {
  try {
    const saveButton = document.getElementById('save-report-btn');
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...`;
    
    const reportId = document.getElementById('report-id').value;
    const reportTitle = document.getElementById('report-title').value;
    
    // Gather all sections data
    const sections = [];
    document.querySelectorAll('.content-section').forEach(sectionEl => {
      const titleInput = sectionEl.querySelector('.section-title');
      const contentTextarea = sectionEl.querySelector('.section-content');
      
      sections.push({
        title: titleInput.value,
        content: contentTextarea.value
      });
    });
    
    // Prepare the report data for update
    const reportData = {
      title: reportTitle,
      content: { sections },
      updated_at: new Date().toISOString()
    };
    
    // Send the update request
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(reportData)
    });
    
    if (!response.ok) {
      throw new Error(`API update failed with status ${response.status}`);
    }
    
    const updatedReport = await response.json();
    
    saveButton.disabled = false;
    saveButton.innerHTML = `<i class="fas fa-save"></i> Save Report`;
    
    // Show success message
    const editContainer = document.getElementById('report-edit');
    editContainer.insertAdjacentHTML('afterbegin', `
      <div class="alert alert-success alert-dismissible fade show" role="alert">
        Report updated successfully!
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `);
    
    // Auto-dismiss the alert after 3 seconds
    setTimeout(() => {
      const alert = document.querySelector('.alert-success');
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 3000);
    
  } catch (error) {
    console.error('Error saving report:', error);
    const saveButton = document.getElementById('save-report-btn');
    saveButton.disabled = false;
    saveButton.innerHTML = `<i class="fas fa-save"></i> Save Report`;
    
    // Show error message
    const editContainer = document.getElementById('report-edit');
    editContainer.insertAdjacentHTML('afterbegin', `
      <div class="alert alert-danger alert-dismissible fade show" role="alert">
        Error saving report: ${error.message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>

        // Initialize the app
        function createReportsApp() {
          const container = document.getElementById('reports-app');
          
          // Create app container with tabs
          container.innerHTML = `
            <div class="container-fluid">
              <div class="row mb-4">
                <div class="col">
                  <h1>Reports</h1>
                  <ul class="nav nav-tabs" id="reportsAppTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                      <button class="nav-link active" id="reports-tab" data-bs-toggle="tab" data-bs-target="#reports-pane" 
                              type="button" role="tab" aria-controls="reports-pane" aria-selected="true">
                        <i class="fas fa-file-alt"></i> Reports
                      </button>
                    </li>
                    <li class="nav-item" role="presentation">
                      <button class="nav-link" id="projects-tab" data-bs-toggle="tab" data-bs-target="#projects-pane" 
                              type="button" role="tab" aria-controls="projects-pane" aria-selected="false">
                        <i class="fas fa-project-diagram"></i> Projects
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div class="tab-content" id="reportsAppTabContent">
                <div class="tab-pane fade show active" id="reports-pane" role="tabpanel" aria-labelledby="reports-tab">
                  <div id="reports-list-container">
                    <div class="text-center my-5">
                      <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                      </div>
                      <p class="mt-2">Loading reports...</p>
                    </div>
                  </div>
                </div>
                
                <div class="tab-pane fade" id="projects-pane" role="tabpanel" aria-labelledby="projects-tab">
                  <div id="projects-list-container">
                    <div class="text-center my-5">
                      <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                      </div>
                      <p class="mt-2">Loading projects...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          // Initialize Bootstrap tabs
          if (typeof bootstrap !== 'undefined') {
            const tabElms = document.querySelectorAll('#reportsAppTabs button');
            tabElms.forEach(tab => {
              tab.addEventListener('click', function(event) {
                event.preventDefault();
                if (this.id === 'projects-tab') {
                  fetchProjects();
                } else if (this.id === 'reports-tab') {
                  fetchReports();
                }
              });
            });
          }
          
          // Start by loading reports
          fetchReports();
        }

        // Fetch and render projects list
        async function fetchProjects() {
          const container = document.getElementById('projects-list-container');
          
          // Show loading indicator
          container.innerHTML = `
            <div class="text-center my-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2">Loading projects...</p>
            </div>
          `;
          
          try {
            // Fetch projects data from API
            const response = await fetch('/api/projects');
            if (!response.ok) {
              throw new Error(`API request failed with status ${response.status}`);
            }
            
            const projects = await response.json();
            renderProjectsList(container, projects);
            
          } catch (error) {
            console.error('Error fetching projects:', error);
            container.innerHTML = `
              <div class="alert alert-danger">
                <h4>Error Loading Projects</h4>
                <p>${error.message}</p>
                <button class="btn btn-primary mt-2" onclick="fetchProjects()">
                  <i class="fas fa-sync"></i> Try Again
                </button>
              </div>
            `;
          }
        }

        // Render projects list
        function renderProjectsList(container, projects) {
          let html = `
            <div class="card">
              <div class="card-header">
                <h5>Available Projects</h5>
              </div>
              <div class="card-body">
          `;
          
          if (projects.length === 0) {
            html += `<p>No projects found.</p>`;
          } else {
            html += `
              <div class="table-responsive">
                <table class="table table-striped table-hover" id="projects-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Business Unit</th>
                      <th>Criticality</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
            `;
            
            projects.forEach(project => {
              // Criticality badge color
              let criticalityBadgeClass = 'bg-secondary';
              if (project.criticality) {
                if (project.criticality.toLowerCase().includes('high')) {
                  criticalityBadgeClass = 'bg-danger';
                } else if (project.criticality.toLowerCase().includes('medium')) {
                  criticalityBadgeClass = 'bg-warning text-dark';
                } else if (project.criticality.toLowerCase().includes('low')) {
                  criticalityBadgeClass = 'bg-success';
                }
              }
              
              // Status badge color
              let statusBadgeClass = 'bg-secondary';
              if (project.status) {
                if (project.status.toLowerCase() === 'active') {
                  statusBadgeClass = 'bg-success';
                } else if (project.status.toLowerCase() === 'planning') {
                  statusBadgeClass = 'bg-info';
                } else if (project.status.toLowerCase() === 'complete') {
                  statusBadgeClass = 'bg-primary';
                } else if (project.status.toLowerCase() === 'on hold') {
                  statusBadgeClass = 'bg-warning text-dark';
                }
              }
              
              const projectName = encodeURIComponent(project.name || 'Unnamed Project');
              
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
            
            html += `
                </tbody>
              </table>
              </div>
            `;
          }
          
          html += `
              </div>
            </div>
          `;
          
          // Set the HTML to the container
          container.innerHTML = html;
          
          // Initialize DataTable if available
          if (typeof $.fn.DataTable !== 'undefined') {
            $('#projects-table').DataTable({
              responsive: true,
              pageLength: 10,
              lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]]
            });
          }
        }

        // Initialize the app when document is loaded
        document.addEventListener('DOMContentLoaded', () => {
          console.log('Initializing vanilla JS reports app');
          createReportsApp();
        });
