// Simple Reports App - Minimal Version
// This version has no dependencies on external modules

// Access React from global scope
const React = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect } = React;

// Simple app component
const ReportsApp = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch reports from PostgREST API
    const fetchReports = async () => {
      try {
        const response = await fetch('http://localhost:3010/reports.report');
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        setReports(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (error) {
    return (
      <div className="alert alert-danger">
        <h4>Error</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col">
          <h1>Reports</h1>
          <p className="lead">View and manage threat modeling reports</p>
        </div>
      </div>
      
      <div className="row">
        <div className="col">
          <div className="card">
            <div className="card-header">
              <h5>Available Reports</h5>
            </div>
            <div className="card-body">
              {reports.length === 0 ? (
                <p>No reports found. Create a new report to get started.</p>
              ) : (
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => (
                      <tr key={report.id}>
                        <td>{report.title}</td>
                        <td>{new Date(report.created_at).toLocaleString()}</td>
                        <td>
                          <button className="btn btn-sm btn-primary me-2">
                            <i className="fas fa-eye"></i> View
                          </button>
                          <button className="btn btn-sm btn-secondary">
                            <i className="fas fa-edit"></i> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Initialize the app when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('reports-app');
  if (appContainer) {
    try {
      ReactDOM.render(<ReportsApp />, appContainer);
      console.log('Reports app rendered successfully');
    } catch (error) {
      console.error('Error rendering Reports app:', error);
      appContainer.innerHTML = `
        <div class="alert alert-danger">
          <h4>Error Loading Reports App</h4>
          <p>There was a problem loading the reports application. Please try again.</p>
          <p><small>${error.message}</small></p>
        </div>
      `;
    }
  } else {
    console.error('Could not find reports-app element');
  }
});
