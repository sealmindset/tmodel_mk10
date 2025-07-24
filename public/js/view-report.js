/**
 * View Report Page JavaScript
 * Handles report viewing, editing, and exporting functionality
 */

let currentReport = null;
let editor = null;

/**
 * Initialize the view report page
 * @param {string} reportId - ID of the report to view
 */
function initViewReportPage(reportId) {
  console.log('Initializing view report page for report ID:', reportId);
  
  if (!reportId) {
    showError('No report ID provided');
    return;
  }
  
  // Fetch report data
  fetchReport(reportId)
    .then(setupReportView)
    .catch(error => {
      console.error('Error loading report:', error);
      showError(`Failed to load report: ${error.message}`);
    });
  
  // Initialize tabs
  setupTabs();
  
  // Setup export buttons
  setupExportButtons();
}

/**
 * Fetch report data from API
 * @param {string} reportId - ID of the report to fetch
 * @returns {Promise<Object>} Report data
 */
async function fetchReport(reportId) {
  try {
    // Fetch report data from PostgREST
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`, {
      headers: {
        'Accept': 'application/json'
      },
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.status}`);
    }
    
    const reports = await response.json();
    
    if (reports.length === 0) {
      throw new Error('Report not found');
    }
    
    // Get the first (and should be only) report
    const report = reports[0];
    console.log('Report data:', report);
    
    // Fetch project data
    const projectId = report.project_uuid || report.project_id;
    const projectResponse = await fetch(`/api/projects/${projectId}`);
    
    if (projectResponse.ok) {
      const project = await projectResponse.json();
      report.project = project;
    } else {
      console.warn('Could not fetch project details:', projectResponse.status);
    }
    
    return report;
  } catch (error) {
    console.error('Error fetching report:', error);
    throw error;
  }
}

/**
 * Setup the report viewer with fetched data
 * @param {Object} report - The report data
 */
function setupReportView(report) {
  // Store current report data
  currentReport = report;
  
  // Set report title
  document.getElementById('report-title').textContent = report.title;
  
  // Set project information
  if (report.project) {
    document.getElementById('project-name').textContent = report.project.name || 'N/A';
    document.getElementById('business-unit').textContent = report.project.business_unit || 'N/A';
    document.getElementById('criticality').textContent = report.project.criticality || 'N/A';
  } else {
    document.getElementById('project-name').textContent = 'Project information not available';
  }
  
  // Set generated date
  const reportDate = new Date(report.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  document.getElementById('date-generated').textContent = reportDate;
  
  // Get report content
  let markdownContent = '';
  if (report.content) {
    if (typeof report.content === 'string') {
      try {
        markdownContent = JSON.parse(report.content);
      } catch (e) {
        markdownContent = report.content;
      }
    } else if (typeof report.content === 'object') {
      // Handle cases where content is already parsed JSON
      markdownContent = formatReportContentToMarkdown(report.content);
    }
  }
  
  // Initialize markdown editor
  initEditor(markdownContent);
  
  // Render markdown preview
  renderMarkdownPreview(markdownContent);
  
  // Setup save button
  document.getElementById('btn-save').addEventListener('click', saveReportChanges);
  
  // Setup regenerate section button
  document.getElementById('btn-regenerate-section').addEventListener('click', showRegenerateSectionDialog);
}

/**
 * Format report content object into markdown
 * @param {Object} content - The report content object
 * @returns {string} Formatted markdown
 */
function formatReportContentToMarkdown(content) {
  let markdown = '';
  
  // If content is a string, return it directly
  if (typeof content === 'string') {
    return content;
  }
  
  // If content has sections property (from LLM generation)
  if (content.sections) {
    Object.entries(content.sections).forEach(([sectionName, sectionContent]) => {
      // Format section name as title
      const title = sectionName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      
      markdown += `# ${title}\n\n${sectionContent}\n\n`;
    });
    return markdown;
  }
  
  // If content is a simple object with section keys
  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string') {
      const title = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      
      markdown += `# ${title}\n\n${value}\n\n`;
    }
  }
  
  return markdown;
}

/**
 * Initialize the markdown editor
 * @param {string} content - The initial markdown content
 */
function initEditor(content) {
  // Initialize SimpleMDE editor
  editor = new SimpleMDE({
    element: document.getElementById('markdown-editor'),
    spellChecker: false,
    autofocus: false,
    initialValue: content,
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'unordered-list', 'ordered-list', '|',
      'link', 'image', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ]
  });
  
  // Update preview when editor changes
  editor.codemirror.on('change', () => {
    renderMarkdownPreview(editor.value());
  });
}

/**
 * Render markdown in preview pane
 * @param {string} markdown - Markdown content to render
 */
function renderMarkdownPreview(markdown) {
  const previewPane = document.getElementById('preview-pane');
  previewPane.innerHTML = marked.parse(markdown || '');
}

/**
 * Setup tab navigation
 */
function setupTabs() {
  const viewTab = document.getElementById('view-tab');
  const editTab = document.getElementById('edit-tab');
  
  viewTab.addEventListener('click', (e) => {
    e.preventDefault();
    // Update preview with latest content from editor
    if (editor) {
      renderMarkdownPreview(editor.value());
    }
  });
  
  editTab.addEventListener('click', (e) => {
    e.preventDefault();
    // Refresh editor layout when tab is shown
    if (editor) {
      setTimeout(() => editor.codemirror.refresh(), 10);
    }
  });
}

/**
 * Save report changes
 */
async function saveReportChanges() {
  if (!currentReport || !editor) {
    showError('No report data available');
    return;
  }
  
  const updatedContent = editor.value();
  
  try {
    // Update content and updated_at fields
    const updateResponse = await fetch(`http://localhost:3010/report?id=eq.${currentReport.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      mode: 'cors',
      body: JSON.stringify({
        content: updatedContent,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to save changes: ${updateResponse.status}`);
    }
    
    const updatedReport = await updateResponse.json();
    console.log('Report updated:', updatedReport);
    
    // Show success message
    showSuccess('Report saved successfully');
    
    // Update current report data
    currentReport = updatedReport[0] || currentReport;
  } catch (error) {
    console.error('Error saving report:', error);
    showError(`Failed to save report: ${error.message}`);
  }
}

/**
 * Show dialog to regenerate a specific section
 */
function showRegenerateSectionDialog() {
  // This could be implemented with a modal to select which section to regenerate
  alert('Section regeneration will be implemented in a future update.');
}

/**
 * Setup export buttons
 */
function setupExportButtons() {
  // PDF Export
  document.getElementById('btn-pdf').addEventListener('click', exportToPdf);
  
  // Markdown Download
  document.getElementById('btn-markdown').addEventListener('click', downloadMarkdown);
  
  // Print
  document.getElementById('btn-print').addEventListener('click', printReport);
}

/**
 * Export report as PDF
 */
function exportToPdf() {
  if (!currentReport) return;
  
  const reportTitle = currentReport.title || 'Report';
  const previewPane = document.getElementById('preview-pane');
  
  // Create a clone of the preview pane for PDF generation
  const element = previewPane.cloneNode(true);
  
  // Add report title at the top
  const titleElement = document.createElement('h1');
  titleElement.textContent = reportTitle;
  element.prepend(titleElement);
  
  // PDF configuration
  const options = {
    margin: [10, 10],
    filename: `${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // Generate and download PDF
  html2pdf().set(options).from(element).save();
}

/**
 * Download report as Markdown file
 */
function downloadMarkdown() {
  if (!currentReport || !editor) return;
  
  const reportTitle = currentReport.title || 'Report';
  const markdown = editor.value();
  
  // Create download link
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `${reportTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.md`;
  link.click();
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Print report
 */
function printReport() {
  window.print();
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
  document.querySelectorAll('.alert').forEach(el => el.remove());
  
  // Create new alert
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Insert at top of tab content
  const tabContent = document.querySelector('.tab-content');
  tabContent.insertBefore(alert, tabContent.firstChild);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alert);
    bsAlert.close();
  }, 5000);
}
