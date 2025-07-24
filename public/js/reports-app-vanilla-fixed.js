// Vanilla JS Reports App - Fixed Version
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
    
    let projects = await response.json();
    // Ensure projects is an array
    if (!Array.isArray(projects)) {
      console.warn('API response is not an array, converting to array:', projects);
      // If it's a single project object, wrap it in an array
      if (projects && typeof projects === 'object') {
        projects = [projects];
      } else {
        projects = [];
      }
    }
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
  
  if (!contentContainer) {
    console.error('ERROR: reports-content container not found!');
    // Create a fallback container if missing
    const fallbackContainer = document.createElement('div');
    fallbackContainer.id = 'reports-content';
    fallbackContainer.className = 'card';
    document.body.appendChild(fallbackContainer);
    console.log('Created fallback reports-content container');
    return;
  }
  
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
    let reportsData = await response.json();
    console.log('DEBUG: Reports data:', reportsData);
    
    // Ensure reports is an array (using a new variable name to avoid reassignment)
    if (!Array.isArray(reportsData)) {
      console.warn('API response is not an array, converting to array:', reportsData);
      if (reportsData && typeof reportsData === 'object') {
        reportsData = [reportsData];
      } else {
        reportsData = [];
      }
    }
    
    console.log('DEBUG: About to render reports list with data:', reportsData);
    renderReportsList(contentContainer, reportsData);
  } catch (error) {
    console.error('Error fetching reports:', error);
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (errorMessage.includes('CORS') || errorMessage.includes('blocked by CORS policy')) {
      errorMessage += '\nThis may be a CORS policy issue. Check that the PostgREST server has appropriate CORS headers enabled.';
      console.error('CORS issue detected. Please make sure PostgREST has these headers:', {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
    }
    
    // Make sure contentContainer still exists
    if (contentContainer) {
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
Error: ${error.toString()}
Check network tab for more details</pre>
            </details>
          </div>
        </div>
      `;
    } else {
      console.error('Cannot display error: contentContainer not found');
    }
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

// Render the reports list
function renderReportsList(container, reports) {
  let html = `
    <div class="card">
      <div class="card-header">
        <div class="d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Available Reports</h5>
          <div>
            <button class="btn btn-sm btn-success" onclick="createNewReport()">
              <i class="fas fa-plus"></i> Create New Report
            </button>
          </div>
        </div>
      </div>
      <div class="card-body">
  `;
  
  if (!reports || reports.length === 0) {
    html += `
      <p>No reports found. Click the button above to create a new report.</p>
    `;
  } else {
    html += `
      <div class="table-responsive">
        <table class="table table-striped table-hover" id="reports-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date Created</th>
              <th>Date Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    reports.forEach(report => {
      const createdAt = new Date(report.created_at).toLocaleString();
      const updatedAt = new Date(report.updated_at).toLocaleString();
      
      html += `
        <tr>
          <td>${report.title || 'Untitled Report'}</td>
          <td>${createdAt}</td>
          <td>${updatedAt}</td>
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
      lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "All"]],
      order: [[1, 'desc']] // Sort by date created, newest first
    });
  }
}

// Helper function to get appropriate badge class for criticality
function getCriticalityBadgeClass(criticality) {
  if (!criticality) return 'bg-secondary';
  
  const critLower = criticality.toLowerCase();
  if (critLower.includes('high')) {
    return 'bg-danger';
  } else if (critLower.includes('medium')) {
    return 'bg-warning text-dark';
  } else if (critLower.includes('low')) {
    return 'bg-success';
  }
  
  return 'bg-secondary';
}

// Helper function to get appropriate badge class for status
function getStatusBadgeClass(status) {
  if (!status) return 'bg-secondary';
  
  const statusLower = status.toLowerCase();
  if (statusLower === 'active') {
    return 'bg-success';
  } else if (statusLower === 'planning') {
    return 'bg-info';
  } else if (statusLower === 'complete') {
    return 'bg-primary';
  } else if (statusLower === 'on hold') {
    return 'bg-warning text-dark';
  }
  
  return 'bg-secondary';
}

// Create a new blank report without a specific project
function createNewReport() {
  alert('This feature is not yet implemented.');
  // Will be implemented in a future update
}

// Navigate to the report-generator page for a project
function generateReport(projectId, projectName) {
  if (!projectId) {
    console.error('generateReport called without projectId');
    return;
  }
  // Optional: visual feedback before redirect
  const btn = event?.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Redirecting…';
  }
  // Generator page uses /reports/new/:uuid route
  window.location.href = `/reports/new/${projectId}`;
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
  fetch(`/report?id=eq.${reportId}`)
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
      
      // Parse report content
      const content = report.content || { sections: [] };
      const sections = content.sections || [];
      
      // Render report view
      contentContainer.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0">${report.title || 'Untitled Report'}</h5>
              <div>
                <div class="btn-group" role="group">
                  <button class="btn btn-sm btn-primary" onclick="exportReportToPdf(${reportId})">
                    <i class="fas fa-file-pdf"></i> Export PDF
                  </button>
                  <button class="btn btn-sm btn-secondary" onclick="exportReportToMarkdown(${reportId})">
                    <i class="fas fa-file-alt"></i> Export Markdown
                  </button>
                  <button class="btn btn-sm btn-info" onclick="printReport(${reportId})">
                    <i class="fas fa-print"></i> Print
                  </button>
                </div>
                <div class="btn-group ms-2" role="group">
                  <button class="btn btn-sm btn-warning" onclick="editReport(${reportId})">
                    <i class="fas fa-edit"></i> Edit
                  </button>
                  <button class="btn btn-sm btn-secondary" onclick="fetchReports()">
                    <i class="fas fa-arrow-left"></i> Back
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="card-body markdown-preview">
      `;
      
      // Add each section
      sections.forEach(section => {
        contentContainer.querySelector('.card-body').innerHTML += `
          <h2>${section.title}</h2>
          ${marked.parse(section.content || '')}
        `;
      });
      
      contentContainer.querySelector('.card-body').innerHTML += `
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
  fetch(`/report?id=eq.${reportId}`)
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
      
      // Parse report content
      const content = report.content || { sections: [] };
      const sections = content.sections || [];
      
      // Render report edit form
      contentContainer.innerHTML = `
        <div class="card" id="report-edit">
          <div class="card-header">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Edit Report</h5>
              <div>
                <button class="btn btn-sm btn-primary" id="save-report-btn" onclick="saveReport()">
                  <i class="fas fa-save"></i> Save Report
                </button>
                <button class="btn btn-sm btn-secondary" onclick="fetchReports()">
                  <i class="fas fa-times"></i> Cancel
                </button>
              </div>
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

// Initialize the app when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing vanilla JS reports app');
  createReportsApp();
});
