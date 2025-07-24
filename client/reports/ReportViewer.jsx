import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Button, Card, Container, Row, Col, 
  Spinner, Alert, Tab, Tabs, Badge,
  ListGroup
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faArrowLeft, faHistory, faDownload } from '@fortawesome/free-solid-svg-icons';
import MarkdownPreview from './MarkdownPreview';

const ReportViewer = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [project, setProject] = useState(null);
  const [template, setTemplate] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [error, setError] = useState(null);
  
  // Fetch report data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch report data using PostgREST
        const reportResponse = await axios.get(
          `http://localhost:3010/reports.report?id=eq.${reportId}`
        );
        
        if (reportResponse.data.length === 0) {
          setError('Report not found');
          setLoading(false);
          return;
        }
        
        const reportData = reportResponse.data[0];
        setReport(reportData);
        
        // Fetch project data
        const projectResponse = await axios.get(
          `http://localhost:3010/public.projects?id=eq.${reportData.project_id}`
        );
        
        if (projectResponse.data.length > 0) {
          setProject(projectResponse.data[0]);
        }
        
        // Fetch template data
        const templateResponse = await axios.get(
          `http://localhost:3010/reports.template?id=eq.${reportData.template_id}`
        );
        
        if (templateResponse.data.length > 0) {
          setTemplate(templateResponse.data[0]);
        }
        
        // Fetch revisions
        const revisionsResponse = await axios.get(
          `http://localhost:3010/reports.report_revision?report_id=eq.${reportId}&order=created_at.desc`
        );
        
        setRevisions(revisionsResponse.data);
        
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('Failed to load report data. Please check your connection to PostgREST.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [reportId]);
  
  // Render the report content with placeholders filled
  const getRenderedContent = () => {
    if (!template || !report) return '';
    
    let content = template.template_content;
    const reportContent = report.content;
    
    // Replace placeholders with report content
    Object.keys(reportContent).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, reportContent[key]);
    });
    
    return content;
  };
  
  // Export report as markdown file
  const exportMarkdown = () => {
    if (!report || !template) return;
    
    const content = getRenderedContent();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" />
        <p>Loading report data...</p>
      </Container>
    );
  }
  
  if (!report || error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          {error || 'Error loading report'}
        </Alert>
        <Button variant="primary" onClick={() => navigate('/reports')}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Reports
        </Button>
      </Container>
    );
  }
  
  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h1>{report.title}</h1>
          {project && (
            <p className="lead">
              Project: {project.project_name}
              {project.criticality && (
                <Badge 
                  bg={
                    project.criticality === 'High' ? 'danger' :
                    project.criticality === 'Medium' ? 'warning' :
                    project.criticality === 'Low' ? 'info' : 'secondary'
                  }
                  className="ms-2"
                >
                  {project.criticality}
                </Badge>
              )}
            </p>
          )}
        </Col>
        <Col className="text-end">
          <Button variant="secondary" onClick={() => navigate('/reports')} className="me-2">
            <FontAwesomeIcon icon={faArrowLeft} /> Back
          </Button>
          <Button variant="warning" onClick={() => navigate(`/reports/edit/${reportId}`)} className="me-2">
            <FontAwesomeIcon icon={faEdit} /> Edit
          </Button>
          <Button variant="info" onClick={exportMarkdown}>
            <FontAwesomeIcon icon={faDownload} /> Export
          </Button>
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col md={9}>
          <Card>
            <Card.Header as="h5">
              Report Content
              {template && (
                <small className="text-muted ms-2">
                  Template: {template.name}
                </small>
              )}
            </Card.Header>
            <Card.Body>
              <Tabs defaultActiveKey="preview" className="mb-3">
                <Tab eventKey="preview" title="Preview">
                  <div className="border rounded p-3 bg-light">
                    <MarkdownPreview markdown={getRenderedContent()} />
                  </div>
                </Tab>
                <Tab eventKey="raw" title="Raw Markdown">
                  <div className="border rounded p-3">
                    <pre className="m-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {getRenderedContent()}
                    </pre>
                  </div>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card>
            <Card.Header as="h5">
              <FontAwesomeIcon icon={faHistory} /> Revision History
            </Card.Header>
            <Card.Body>
              {revisions.length === 0 ? (
                <p className="text-muted">No revision history available</p>
              ) : (
                <ListGroup variant="flush">
                  {revisions.map((revision, index) => (
                    <ListGroup.Item key={revision.id} className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>Rev {revisions.length - index}</strong>
                        <br />
                        <small className="text-muted">
                          {new Date(revision.created_at).toLocaleString()}
                        </small>
                        <br />
                        <small>{revision.created_by || 'System'}</small>
                      </div>
                      <Button size="sm" variant="outline-secondary">
                        View
                      </Button>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
          
          <Card className="mt-3">
            <Card.Header as="h5">Metadata</Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <strong>Created:</strong> {new Date(report.created_at).toLocaleString()}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Last Modified:</strong> {new Date(report.updated_at).toLocaleString()}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Report ID:</strong> {reportId}
              </ListGroup.Item>
            </ListGroup>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ReportViewer;
