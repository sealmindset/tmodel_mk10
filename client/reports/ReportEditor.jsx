import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Form, Button, Card, Container, Row, Col, 
  Spinner, Alert, Tab, Tabs, Modal
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faHistory, faMagic } from '@fortawesome/free-solid-svg-icons';
import MarkdownPreview from './MarkdownPreview';

const ReportEditor = () => {
  const { reportId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState(null);
  const [project, setProject] = useState(null);
  const [template, setTemplate] = useState(null);
  const [editableContent, setEditableContent] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmModel, setLlmModel] = useState('gpt-4');
  const [regenerateSection, setRegenerateSection] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  
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
        setEditableContent({...reportData.content});
        
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
        
      } catch (err) {
        console.error('Error fetching report data:', err);
        setError('Failed to load report data. Please check your connection to PostgREST.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [reportId]);
  
  // Save report changes
  const saveReport = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update the report
      await axios.patch(
        `http://localhost:3010/reports.report?id=eq.${reportId}`,
        { 
          content: editableContent,
          updated_at: new Date().toISOString()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      );
      
      // Save revision
      await axios.post(
        'http://localhost:3010/reports.report_revision',
        {
          report_id: parseInt(reportId),
          content: editableContent,
          created_by: 'User' // In a real app, would use actual user name
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      setSuccess('Report saved successfully');
      setShowConfirmModal(false);
    } catch (err) {
      console.error('Error saving report:', err);
      setError(`Failed to save report: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Handle content changes
  const handleContentChange = (key, value) => {
    setEditableContent(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Get rendered content for preview
  const getRenderedContent = () => {
    if (!template) return '';
    
    let content = template.template_content;
    
    // Replace placeholders with editable content
    Object.keys(editableContent).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, editableContent[key] || '');
    });
    
    return content;
  };
  
  // Function to regenerate a section using LLM
  const regenerateSectionContent = async () => {
    if (!regenerateSection || !project) return;
    
    try {
      setError(null);
      setSaving(true);
      
      let prompt = customPrompt;
      if (!prompt) {
        // Create a default prompt based on the section
        prompt = `Based on this project titled "${project.project_name}" 
          with a description: "${project.description || 'No description available'}", 
          please generate content for the "${regenerateSection}" section of a technical report.
          Make it detailed, professional, and suitable for a security/threat modeling context.`;
      }
      
      // Call the backend to generate content using LLM
      const response = await axios.post('/api/llm/generate', {
        prompt,
        provider: llmProvider,
        model: llmModel
      });
      
      if (response.data && response.data.text) {
        handleContentChange(regenerateSection, response.data.text);
        
        // Create content section record
        await axios.post(
          'http://localhost:3010/reports.content_section',
          {
            report_id: parseInt(reportId),
            section_name: regenerateSection,
            content: response.data.text,
            llm_provider: llmProvider,
            llm_model: llmModel,
            prompt_used: prompt
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        setSuccess(`Successfully regenerated ${regenerateSection} section`);
        setShowRegenerateModal(false);
      } else {
        setError('Failed to generate content: No text returned from LLM');
      }
    } catch (err) {
      console.error('Error generating content:', err);
      setError(`Failed to generate content: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" />
        <p>Loading report data...</p>
      </Container>
    );
  }
  
  if (!report || !template) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          {error || 'Report or template not found'}
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
          <h1>Edit Report: {report.title}</h1>
          {project && (
            <p className="lead">Project: {project.project_name}</p>
          )}
        </Col>
        <Col className="text-end">
          <Button variant="secondary" onClick={() => navigate(`/reports/view/${reportId}`)} className="me-2">
            <FontAwesomeIcon icon={faArrowLeft} /> Back to View
          </Button>
          <Button 
            variant="primary" 
            onClick={() => setShowConfirmModal(true)} 
            disabled={saving}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" /> Saving...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSave} /> Save Changes
              </>
            )}
          </Button>
        </Col>
      </Row>
      
      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          </Col>
        </Row>
      )}
      
      {success && (
        <Row className="mb-4">
          <Col>
            <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          </Col>
        </Row>
      )}
      
      <Row>
        <Col md={6}>
          <Card>
            <Card.Header as="h5">Edit Report Sections</Card.Header>
            <Card.Body>
              <Tabs defaultActiveKey="content">
                <Tab eventKey="content" title="Content">
                  <div className="p-3">
                    {Object.keys(editableContent).map((key) => (
                      <div key={key} className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h5>{key}</h5>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => {
                              setRegenerateSection(key);
                              setCustomPrompt('');
                              setShowRegenerateModal(true);
                            }}
                          >
                            <FontAwesomeIcon icon={faMagic} /> Regenerate
                          </Button>
                        </div>
                        <Form.Control
                          as="textarea"
                          rows={5}
                          value={editableContent[key] || ''}
                          onChange={(e) => handleContentChange(key, e.target.value)}
                          className="font-monospace"
                        />
                      </div>
                    ))}
                  </div>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header as="h5">Preview</Card.Header>
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
      </Row>
      
      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Save</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Save changes to this report? This will create a new revision in the history.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveReport} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Regenerate Content Modal */}
      <Modal show={showRegenerateModal} onHide={() => setShowRegenerateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Regenerate {regenerateSection} Content</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>LLM Provider</Form.Label>
              <Form.Select 
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
              >
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>LLM Model</Form.Label>
              <Form.Select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
              >
                {llmProvider === 'openai' ? (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                ) : (
                  <>
                    <option value="llama3:latest">Llama 3</option>
                    <option value="mistral:latest">Mistral</option>
                    <option value="codellama:latest">CodeLlama</option>
                  </>
                )}
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Custom Prompt (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={`Write a custom prompt to generate content for the ${regenerateSection} section...`}
              />
              <Form.Text className="text-muted">
                Leave blank to use the default prompt based on the project information
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRegenerateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={regenerateSectionContent} disabled={saving}>
            {saving ? (
              <>
                <Spinner animation="border" size="sm" /> Generating...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faMagic} /> Generate Content
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ReportEditor;
