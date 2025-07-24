// Reports App Bundle
// This file handles the client-side rendering of the Reports app

// Access React from global scope (loaded via CDN)
const React = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect, Fragment } = React;

// Simple tab-based navigation instead of React Router
const TABS = {
  LIST: 'list',
  NEW: 'new',
  VIEW: 'view',
  EDIT: 'edit'
};

// Markdown Preview Component
const MarkdownPreview = ({ markdown }) => {
  const createMarkup = () => {
    return { __html: marked.parse(markdown || '') };
  };

  return (
    <div 
      className="markdown-preview" 
      dangerouslySetInnerHTML={createMarkup()}
    />
  );
};

// Report List Component
const ReportList = ({ navigate }) => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch projects using PostgREST
      const projectsResponse = await fetch('http://localhost:3010/public.projects');
      const projectsData = await projectsResponse.json();
      setProjects(projectsData);

      // Fetch existing reports using PostgREST
      const reportsResponse = await fetch('http://localhost:3010/reports.report');
      const reportsData = await reportsResponse.json();
      setReports(reportsData);

      // Fetch available templates using PostgREST
      const templatesResponse = await fetch('http://localhost:3010/reports.template');
      const templatesData = await templatesResponse.json();
      setTemplates(templatesData);

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please check your connection to PostgREST.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Find projects that don't have reports yet
  const projectsWithoutReports = projects.filter(
    project => !reports.some(report => report.project_id === project.id)
  );

  // Columns for Projects DataTable
  const projectColumns = [
    {
      name: 'Project Name',
      selector: row => row.project_name,
      sortable: true,
    },
    {
      name: 'Business Unit',
      selector: row => row.business_unit || 'N/A',
      sortable: true,
    },
    {
      name: 'Criticality',
      selector: row => row.criticality || 'Unknown',
      sortable: true,
      cell: row => (
        <span className={`badge bg-${
          row.criticality === 'High' ? 'danger' :
          row.criticality === 'Medium' ? 'warning' :
          row.criticality === 'Low' ? 'info' : 'secondary'
        }`}>
          {row.criticality || 'Unknown'}
        </span>
      ),
    },
    {
      name: 'Actions',
      cell: row => (
        <div>
          <button 
            className="btn btn-primary btn-sm me-2"
            onClick={() => navigate(TABS.NEW, { projectId: row.id })}
          >
            <i className="fas fa-plus"></i> Generate Report
          </button>
        </div>
      ),
    }
  ];

  // Columns for Reports DataTable
  const reportColumns = [
    {
      name: 'Project',
      selector: row => {
        const project = projects.find(p => p.id === row.project_id);
        return project ? project.project_name : 'Unknown Project';
      },
      sortable: true,
    },
    {
      name: 'Report Title',
      selector: row => row.title,
      sortable: true,
    },
    {
      name: 'Created',
      selector: row => new Date(row.created_at).toLocaleDateString(),
      sortable: true,
    },
    {
      name: 'Actions',
      cell: row => (
        <div>
          <button 
            className="btn btn-info btn-sm me-2"
            onClick={() => navigate(TABS.VIEW, { reportId: row.id })}
          >
            <i className="fas fa-file-alt"></i> View
          </button>
          <button 
            className="btn btn-warning btn-sm"
            onClick={() => navigate(TABS.EDIT, { reportId: row.id })}
          >
            <i className="fas fa-edit"></i> Edit
          </button>
        </div>
      ),
    }
  ];

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col">
          <h1>Reports</h1>
          <p className="lead">Generate and manage threat modeling reports for your projects</p>
        </div>
        <div className="col text-end">
          <button className="btn btn-secondary" onClick={fetchData}>
            <i className="fas fa-sync"></i> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="row mb-4">
          <div className="col">
            <div className="alert alert-danger">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-header"><h5>Available Projects for Reporting</h5></div>
            <div className="card-body">
              <DataTable
                columns={projectColumns}
                data={projectsWithoutReports}
                pagination
                progressPending={loading}
                progressComponent={<div>Loading projects...</div>}
                noDataComponent="No projects available for report generation"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <div className="card-header"><h5>Existing Reports</h5></div>
            <div className="card-body">
              <DataTable
                columns={reportColumns}
                data={reports}
                pagination
                progressPending={loading}
                progressComponent={<div>Loading reports...</div>}
                noDataComponent="No reports found"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Report Generator Component
const ReportGenerator = ({ projectId, navigate }) => {
  const [project, setProject] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Load project details and templates
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch project details
        const projectResponse = await fetch(`http://localhost:3010/public.projects?id=eq.${projectId}`);
        const projectData = await projectResponse.json();
        
        if (projectData && projectData.length > 0) {
          setProject(projectData[0]);
        } else {
          setError('Project not found');
        }
        
        // Fetch templates
        const templatesResponse = await fetch('http://localhost:3010/reports.template');
        const templatesData = await templatesResponse.json();
        setTemplates(templatesData);
        
        if (templatesData.length > 0) {
          setSelectedTemplate(templatesData[0].id);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load project data or templates');
      }
    };
    
    fetchData();
  }, [projectId]);
  
  const handleGenerateReport = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    
    setGenerating(true);
    setError(null);
    setGenerationProgress(10);
    
    try {
      // Get the template content
      const templateResponse = await fetch(`http://localhost:3010/reports.template?id=eq.${selectedTemplate}`);
      const templateData = await templateResponse.json();
      const template = templateData[0];
      
      setGenerationProgress(30);
      
      // Generate report content using LLM
      const promptData = {
        prompt: generationPrompt || `Generate a threat modeling report for project: ${project.project_name}. ${template.template_content}`,
        model: 'gpt-4', // Default to GPT-4, but can be changed in settings
        provider: 'openai' // Default provider
      };
      
      setGenerationProgress(50);
      
      const generationResponse = await fetch('/api/llm/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(promptData)
      });
      
      const generationResult = await generationResponse.json();
      
      if (generationResult.error) {
        throw new Error(generationResult.error);
      }
      
      setGenerationProgress(80);
      
      // Save the generated report to the database
      const reportData = {
        project_id: parseInt(projectId),
        template_id: parseInt(selectedTemplate),
        title: `${project.project_name} - Security Report`,
        content: { sections: [{ title: 'Generated Report', content: generationResult.content }] }
      };
      
      const saveResponse = await fetch('http://localhost:3010/reports.report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });
      
      const savedReport = await saveResponse.json();
      setGenerationProgress(100);
      
      // Navigate to view the new report
      navigate(TABS.VIEW, { reportId: savedReport[0].id });
    } catch (err) {
      console.error('Error generating report:', err);
      setError(`Failed to generate report: ${err.message}`);
      setGenerating(false);
    }
  };
  
  if (error) {
    return (
      <div className="container">
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={() => navigate(TABS.LIST)}>
            Back to Reports
          </button>
        </div>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="container">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container">
      <div className="row mb-4">
        <div className="col">
          <h1>Generate Report</h1>
          <h3>Project: {project.project_name}</h3>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header">
          <h5>Report Configuration</h5>
        </div>
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">Select Template</label>
              <select 
                className="form-select" 
                value={selectedTemplate} 
                onChange={(e) => setSelectedTemplate(e.target.value)}
                disabled={generating}
              >
                {templates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="row mb-3">
            <div className="col-12">
              <label className="form-label">Custom Generation Prompt (Optional)</label>
              <textarea 
                className="form-control" 
                rows="5" 
                value={generationPrompt} 
                onChange={(e) => setGenerationPrompt(e.target.value)} 
                placeholder={`Default: Generate a threat modeling report for project: ${project.project_name}`}
                disabled={generating}
              ></textarea>
              <small className="form-text text-muted">
                Leave blank to use default prompt based on the selected template.
              </small>
            </div>
          </div>
          
          {generating && (
            <div className="row mb-3">
              <div className="col-12">
                <div className="progress">
                  <div 
                    className="progress-bar progress-bar-striped progress-bar-animated" 
                    role="progressbar" 
                    style={{ width: `${generationProgress}%` }} 
                    aria-valuenow={generationProgress} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  >
                    {generationProgress}%
                  </div>
                </div>
                <p className="text-center mt-2">
                  {generationProgress < 50 ? 'Preparing template and project data...' : 
                   generationProgress < 80 ? 'Generating report with AI...' : 
                   'Saving report...'}
                </p>
              </div>
            </div>
          )}
          
          <div className="row">
            <div className="col-12 d-flex justify-content-between">
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate(TABS.LIST)} 
                disabled={generating}
              >
                <i className="fas fa-arrow-left"></i> Back to Reports
              </button>
              
              <button 
                className="btn btn-primary" 
                onClick={handleGenerateReport} 
                disabled={generating || !selectedTemplate}
              >
                {generating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-magic"></i> Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Report Viewer Component
const ReportViewer = ({ reportId, navigate }) => {
  const [report, setReport] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        // Fetch report details
        const reportResponse = await fetch(`http://localhost:3010/reports.report?id=eq.${reportId}`);
        const reportData = await reportResponse.json();
        
        if (reportData && reportData.length > 0) {
          setReport(reportData[0]);
          
          // Fetch associated project details
          const projectResponse = await fetch(`http://localhost:3010/public.projects?id=eq.${reportData[0].project_id}`);
          const projectData = await projectResponse.json();
          
          if (projectData && projectData.length > 0) {
            setProject(projectData[0]);
          }
        } else {
          setError('Report not found');
        }
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [reportId]);
  
  if (loading) {
    return (
      <div className="container">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="container">
        <div className="alert alert-danger">
          <strong>Error:</strong> {error || 'Report not found'}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={() => navigate('/')}>
            Back to Reports
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container">
      <div className="row mb-4">
        <div className="col">
          <h1>{report.title}</h1>
          {project && <h5>Project: {project.project_name}</h5>}
          <p className="text-muted">
            Created: {new Date(report.created_at).toLocaleString()}
            {report.created_at !== report.updated_at && 
              ` (Last updated: ${new Date(report.updated_at).toLocaleString()})`}
          </p>
        </div>
        <div className="col-auto">
          <button className="btn btn-secondary me-2" onClick={() => navigate(TABS.LIST)}>
            <i className="fas fa-arrow-left"></i> Back to Reports
          </button>
          <button className="btn btn-primary" onClick={() => navigate(TABS.EDIT, { reportId })}>
            <i className="fas fa-edit"></i> Edit Report
          </button>
        </div>
      </div>
      
      <div className="card">
        <div className="card-body">
          {report.content && report.content.sections && report.content.sections.map((section, index) => (
            <div key={index} className="mb-4">
              {section.title && <h3>{section.title}</h3>}
              <MarkdownPreview markdown={section.content} />
            </div>
          ))}
          
          {(!report.content || !report.content.sections || report.content.sections.length === 0) && (
            <div className="alert alert-warning">
              No content sections found in this report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Report Editor Component
const ReportEditor = ({ reportId, navigate }) => {
  const [report, setReport] = useState(null);
  const [editableReport, setEditableReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        // Fetch report details
        const reportResponse = await fetch(`http://localhost:3010/reports.report?id=eq.${reportId}`);
        const reportData = await reportResponse.json();
        
        if (reportData && reportData.length > 0) {
          setReport(reportData[0]);
          setEditableReport(JSON.parse(JSON.stringify(reportData[0]))); // Deep clone for editing
        } else {
          setError('Report not found');
        }
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [reportId]);
  
  const updateSectionContent = (sectionIndex, newContent) => {
    const updatedReport = {...editableReport};
    updatedReport.content.sections[sectionIndex].content = newContent;
    setEditableReport(updatedReport);
  };
  
  const updateSectionTitle = (sectionIndex, newTitle) => {
    const updatedReport = {...editableReport};
    updatedReport.content.sections[sectionIndex].title = newTitle;
    setEditableReport(updatedReport);
  };
  
  const addSection = () => {
    const updatedReport = {...editableReport};
    if (!updatedReport.content) {
      updatedReport.content = {};
    }
    if (!updatedReport.content.sections) {
      updatedReport.content.sections = [];
    }
    updatedReport.content.sections.push({
      title: 'New Section',
      content: 'Enter section content here...'
    });
    setEditableReport(updatedReport);
  };
  
  const removeSection = (sectionIndex) => {
    const updatedReport = {...editableReport};
    updatedReport.content.sections.splice(sectionIndex, 1);
    setEditableReport(updatedReport);
  };
  
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      // Create a revision record first
      const revisionData = {
        report_id: parseInt(reportId),
        previous_content: report.content,
        revision_number: 1, // Will need to fetch highest revision number + 1 in a real implementation
        changes_summary: 'Manual edit'
      };
      
      await fetch('http://localhost:3010/reports.report_revision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(revisionData)
      });
      
      // Now update the report
      await fetch(`http://localhost:3010/reports.report?id=eq.${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title: editableReport.title,
          content: editableReport.content,
        })
      });
      
      setSaveSuccess(true);
      setReport({...editableReport}); // Update the original report with edits
      
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving report:', err);
      setError(`Failed to save report: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="container">
        <div className="alert alert-danger">
          <strong>Error:</strong> {error || 'Report not found'}
          <button className="btn btn-sm btn-outline-danger ms-3" onClick={() => navigate('/')}>
            Back to Reports
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container">
      <div className="row mb-4">
        <div className="col">
          <h1>Edit Report</h1>
          <input 
            type="text" 
            className="form-control form-control-lg" 
            value={editableReport.title} 
            onChange={(e) => setEditableReport({...editableReport, title: e.target.value})}
          />
        </div>
        <div className="col-auto d-flex align-items-center">
          {saveSuccess && (
            <div className="text-success me-3">
              <i className="fas fa-check-circle"></i> Saved successfully!
            </div>
          )}
          <button className="btn btn-secondary me-2" onClick={() => navigate(TABS.VIEW, { reportId })}>
            <i className="fas fa-eye"></i> View Report
          </button>
          <button className="btn btn-success" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Section Editor */}
      {editableReport.content && editableReport.content.sections && editableReport.content.sections.map((section, index) => (
        <div key={index} className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <input 
              type="text" 
              className="form-control" 
              value={section.title} 
              onChange={(e) => updateSectionTitle(index, e.target.value)}
            />
            <button 
              className="btn btn-danger btn-sm ms-2" 
              onClick={() => removeSection(index)}
              disabled={editableReport.content.sections.length <= 1}
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <h5>Edit</h5>
                <textarea 
                  className="form-control" 
                  rows="15" 
                  value={section.content} 
                  onChange={(e) => updateSectionContent(index, e.target.value)}
                ></textarea>
              </div>
              <div className="col-md-6">
                <h5>Preview</h5>
                <div className="border p-3" style={{minHeight: '300px'}}>
                  <MarkdownPreview markdown={section.content} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {(!editableReport.content || !editableReport.content.sections || editableReport.content.sections.length === 0) && (
        <div className="alert alert-warning">
          No content sections found. Add a section to get started.
        </div>
      )}
      
      <div className="row mb-4">
        <div className="col">
          <button className="btn btn-primary" onClick={addSection}>
            <i className="fas fa-plus"></i> Add Section
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const ReportsApp = () => {
  const [activeTab, setActiveTab] = useState(TABS.LIST);
  const [params, setParams] = useState({});

  // Helper function to navigate between tabs
  const navigate = (tab, tabParams = {}) => {
    setActiveTab(tab);
    setParams(tabParams);
    window.scrollTo(0, 0);
  };

  // Render the active tab
  const renderContent = () => {
    switch (activeTab) {
      case TABS.LIST:
        return <ReportList navigate={navigate} />;
      case TABS.NEW:
        return <ReportGenerator projectId={params.projectId} navigate={navigate} />;
      case TABS.VIEW:
        return <ReportViewer reportId={params.reportId} navigate={navigate} />;
      case TABS.EDIT:
        return <ReportEditor reportId={params.reportId} navigate={navigate} />;
      default:
        return <ReportList navigate={navigate} />;
    }
  };

  return (
    <div className="reports-app-container">
      {renderContent()}
    </div>
  );
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('reports-app');
  if (root) {
    try {
      // Using React 17 render
      ReactDOM.render(
        <ReportsApp />,
        root
      );
      console.log('Reports app rendered successfully');
    } catch (error) {
      console.error('Error rendering Reports app:', error);
      // Show a user-friendly error
      root.innerHTML = `
        <div class="alert alert-danger">
          <h4>Error Loading Reports App</h4>
          <p>There was a problem loading the reports application. Please refresh the page or contact support.</p>
          <p><small>Technical details: ${error.message}</small></p>
        </div>
      `;
    }
  } else {
    console.error('Could not find reports-app element');
  }
});
