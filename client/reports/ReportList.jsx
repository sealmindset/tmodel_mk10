import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import DataTable from 'react-data-table-component';
import { Button, Card, Container, Row, Col, Badge } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faPlus, faSync, faFileAlt } from '@fortawesome/free-solid-svg-icons';

const ReportList = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch projects using PostgREST
      const projectsResponse = await axios.get('http://localhost:3010/public.projects');
      setProjects(projectsResponse.data);

      // Fetch existing reports using PostgREST
      const reportsResponse = await axios.get('http://localhost:3010/reports.report');
      setReports(reportsResponse.data);

      // Fetch available templates using PostgREST
      const templatesResponse = await axios.get('http://localhost:3010/reports.template');
      setTemplates(templatesResponse.data);

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
        <Badge bg={
          row.criticality === 'High' ? 'danger' :
          row.criticality === 'Medium' ? 'warning' :
          row.criticality === 'Low' ? 'info' : 'secondary'
        }>
          {row.criticality || 'Unknown'}
        </Badge>
      ),
    },
    {
      name: 'Actions',
      cell: row => (
        <div>
          <Link to={`/reports/new/${row.id}`}>
            <Button variant="primary" size="sm" className="mr-2">
              <FontAwesomeIcon icon={faPlus} /> Generate Report
            </Button>
          </Link>
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
      name: 'Template',
      selector: row => {
        const template = templates.find(t => t.id === row.template_id);
        return template ? template.name : 'Unknown Template';
      },
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
          <Link to={`/reports/view/${row.id}`}>
            <Button variant="info" size="sm" className="mr-2">
              <FontAwesomeIcon icon={faFileAlt} /> View
            </Button>
          </Link>
          <Link to={`/reports/edit/${row.id}`}>
            <Button variant="warning" size="sm" className="mr-2">
              <FontAwesomeIcon icon={faFile} /> Edit
            </Button>
          </Link>
        </div>
      ),
    }
  ];

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h1>Reports</h1>
          <p className="lead">Generate and manage threat modeling reports for your projects</p>
        </Col>
        <Col className="text-end">
          <Button variant="secondary" onClick={fetchData}>
            <FontAwesomeIcon icon={faSync} /> Refresh
          </Button>
        </Col>
      </Row>

      {error && (
        <Row className="mb-4">
          <Col>
            <div className="alert alert-danger">
              <strong>Error:</strong> {error}
            </div>
          </Col>
        </Row>
      )}

      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header as="h5">Available Projects for Reporting</Card.Header>
            <Card.Body>
              <DataTable
                columns={projectColumns}
                data={projectsWithoutReports}
                pagination
                progressPending={loading}
                progressComponent={<div>Loading projects...</div>}
                noDataComponent="No projects available for report generation"
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card>
            <Card.Header as="h5">Existing Reports</Card.Header>
            <Card.Body>
              <DataTable
                columns={reportColumns}
                data={reports}
                pagination
                progressPending={loading}
                progressComponent={<div>Loading reports...</div>}
                noDataComponent="No reports found"
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ReportList;
