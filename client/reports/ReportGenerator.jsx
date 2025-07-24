import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Form, Button, Card, Container, Row, Col, 
  Spinner, Alert, ProgressBar, Tab, Tabs 
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faSync } from '@fortawesome/free-solid-svg-icons';
import MarkdownPreview from './MarkdownPreview';

const ReportGenerator = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [project, setProject] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [reportTitle, setReportTitle] = useState('');
  const [generatedContent, setGeneratedContent] = useState({});
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmModel, setLlmModel] = useState('gpt-4');
  const [threatModels, setThreatModels] = useState([]);
  
  // Fetch project and available templates
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch project data using PostgREST
        const projectResponse = await axios.get(
          `http://localhost:3010/public.projects?id=eq.${projectId}`
        );
        
        if (projectResponse.data.length > 0) {
          const projectData = projectResponse.data[0];
          setProject(projectData);
          setReportTitle(`${projectData.project_name} - Threat Model Report`);
        } else {
          setError('Project not found');
          return;
        }

        // Fetch templates using PostgREST
        const templatesResponse = await axios.get(
          'http://localhost:3010/reports.template'
        );
        setTemplates(templatesResponse.data);
        
        if (templatesResponse.data.length > 0) {
          setSelectedTemplate(templatesResponse.data[0].id);
        }
        
        // Fetch threat models for this project
        const threatModelResponse = await axios.get(
          `http://localhost:3010/threat_model.threats?project_id=eq.${projectId}`
        );
        setThreatModels(threatModelResponse.data);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load project data or templates. Please check your connection to PostgREST.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [projectId]);
  
  // Function to generate report content using LLM
  const generateReport = async () => {
    if (!selectedTemplate || !project) return;
    
    setGenerating(true);
    setProgress(0);
    setError(null);
    
    try {
      const template = templates.find(t => t.id === parseInt(selectedTemplate));
      if (!template) {
        setError('Selected template not found');
        setGenerating(false);
        return;
      }
      
      // Initialize content object with placeholders
      let content = {};
      
      // Update progress
      setProgress(10);
      
      // Basic placeholders that can be replaced directly
      content.PROJECT_NAME = project.project_name;
      content.BUSINESS_UNIT = project.business_unit || 'N/A';
      content.CRITICALITY = project.criticality || 'Medium';
      content.DATA_CLASSIFICATION = project.data_classification || 'Confidential';
      content.STATUS = project.status || 'Active';
      content.BRANCH = 'main';
      content.IMAGE_NAME = project.project_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      content.VERSION = '1.0.0';
      content.ENVIRONMENT = 'dev';
      
      // Update progress
      setProgress(20);
      
      // Generate system components inventory using LLM
      const componentsPrompt = `Based on this project titled "${project.project_name}" 
        with a description: "${project.description || 'No description available'}", 
        generate a markdown table listing 3-5 possible system components 
        with their descriptions and owners. Format as a markdown table with 
        columns for Component Name, Description, and Owner. Be specific and 
        realistic for a typical enterprise architecture.`;
      
      // Call the backend to generate content using LLM
      const componentsResponse = await axios.post('/api/llm/generate', {
        prompt: componentsPrompt,
        provider: llmProvider,
        model: llmModel
      });
      
      content.COMPONENTS_TABLE = componentsResponse.data.text;
      
      // Update progress
      setProgress(40);
      
      // Generate threat models table using actual threat model data
      if (threatModels.length > 0) {
        let threatModelsTable = '||Threat Model ID||Component||# Threats||# Vulnerabilities||\n';
        threatModels.forEach((threat, index) => {
          threatModelsTable += `|TM-${index+1}|${threat.title || 'Component ' + (index+1)}|${Math.floor(Math.random() * 10) + 1}|${Math.floor(Math.random() * 5)}|\n`;
        });
        content.THREAT_MODELS_TABLE = threatModelsTable;
      } else {
        content.THREAT_MODELS_TABLE = '*No threat models available for this project*';
      }
      
      // Update progress
      setProgress(60);
      
      // Generate threat-to-control mapping using LLM
      const threatControlPrompt = `Based on a project titled "${project.project_name}" 
        that might have security threats, generate a realistic mapping of 3 potential
        threats to security controls from frameworks like NIST 800-53 or CIS Controls.
        Format as a markdown table with columns for Threat, Control Framework, 
        Control ID, and Priority (High/Medium/Low). Be specific and practical.`;
      
      const threatControlResponse = await axios.post('/api/llm/generate', {
        prompt: threatControlPrompt,
        provider: llmProvider,
        model: llmModel
      });
      
      content.THREAT_CONTROL_MAPPING = threatControlResponse.data.text;
      
      // Update progress
      setProgress(80);
      
      // Generate control validation YAML
      content.CONTROL_VALIDATION = `vulnerability_dashboard:
  checks:
    - name: SAST
      tool: SonarQube
      status: PASS
    - name: DAST
      tool: OWASP ZAP
      status: FAIL
    - name: SCA
      tool: Snyk
      status: PASS`;
      
      // Generate governance table
      content.GOVERNANCE_TABLE = `||Control||Jira Issue||Policy Document||Owner||Review Date||Status||
|AC-3|SEC-123|IAM Policy|${project.owner || 'Alice'}|2025-07-01|In Progress|
|CIS-18.1|SEC-456|Input Validation Policy|${project.secondary_owner || 'Bob'}|2025-07-05|Complete|`;
      
      // Generate module structure
      content.MODULE_STRUCTURE = `||Directory||Purpose||
|modules/network/|VPC, subnets, security groups|
|modules/identity/|IAM roles and policies|
|modules/compute/|Compute instances with hardened images|
|modules/monitoring/|Logging, metrics, alerting|`;
      
      // Generate security config
      content.SECURITY_CONFIG = `module "network" {
  source   = "./modules/network"
  vpc_cidr = var.vpc_cidr
}

resource "null_resource" "pre_deploy_checks" {
  provisioner "local-exec" {
    command = <<EOT
terraform fmt -check
terraform validate
tflint
EOT
  }
}

terraform {
  backend "s3" {
    bucket     = var.state_bucket
    key        = "path/to/terraform.tfstate"
    region     = var.aws_region
    encrypt    = true
    kms_key_id = var.kms_key_id
  }
}`;
      
      // Generate compliance content
      content.COMPLIANCE_CONTENT = `- Embed Jira reports with \`{jira:SEC-123,SEC-456}\`  
- Link policy docs: [InfoSec Policy|https://confluence.example.com/infosec]`;
      
      // Generate audit summary
      content.AUDIT_SUMMARY = `||Control||Last Audit Date||Findings||
|AC-3|2025-07-01|2 minor findings|
|CIS-18.1|2025-07-05|No issues|`;
      
      // Update progress
      setProgress(100);
      setGeneratedContent(content);
      setSuccess('Report content generated successfully');
      
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report content. Check the server logs.');
    } finally {
      setGenerating(false);
    }
  };
  
  // Function to save the report
  const saveReport = async () => {
    if (!selectedTemplate || !project || !generatedContent || Object.keys(generatedContent).length === 0) {
      setError('No report content generated yet');
      return;
    }
    
    try {
      // Create new report in the database
      const reportData = {
        project_id: parseInt(projectId),
        template_id: parseInt(selectedTemplate),
        title: reportTitle,
        content: generatedContent
      };
      
      const response = await axios.post(
        'http://localhost:3010/reports.report',
        reportData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      );
      
      // Redirect to the report view page
      if (response.data && response.data[0] && response.data[0].id) {
        setSuccess('Report saved successfully');
        navigate(`/reports/view/${response.data[0].id}`);
      } else {
        setError('Error saving report: No ID returned from the server');
      }
    } catch (err) {
      console.error('Error saving report:', err);
      setError(`Failed to save report: ${err.message}`);
    }
  };
  
  // Get template content for preview
  const getPreviewContent = () => {
    if (!selectedTemplate || templates.length === 0) return '';
    
    let template = templates.find(t => t.id === parseInt(selectedTemplate));
    if (!template) return '';
    
    let content = template.template_content;
    
    // Replace placeholders with generated content
    if (Object.keys(generatedContent).length > 0) {
      Object.keys(generatedContent).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, generatedContent[key]);
      });
    }
    
    return content;
  };
  
  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" />
        <p>Loading project data and templates...</p>
      </Container>
    );
  }
  
  if (!project) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          Project not found or error loading data
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
          <h1>Generate Report</h1>
          <p className="lead">
            Create a comprehensive threat modeling report for {project.project_name}
          </p>
        </Col>
        <Col className="text-end">
          <Button variant="secondary" onClick={() => navigate('/reports')} className="me-2">
            <FontAwesomeIcon icon={faArrowLeft} /> Back
          </Button>
          {Object.keys(generatedContent).length > 0 && (
            <Button variant="success" onClick={saveReport}>
              <FontAwesomeIcon icon={faSave} /> Save Report
            </Button>
          )}
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
      
      <Row className="mb-4">
        <Col md={4}>
          <Card>
            <Card.Header as="h5">Report Configuration</Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Report Title</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="Enter report title"
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Template</Form.Label>
                  <Form.Select 
                    value={selectedTemplate || ''}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                
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
                
                <Button 
                  variant="primary" 
                  onClick={generateReport}
                  disabled={generating}
                  className="w-100"
                >
                  {generating ? (
                    <>
                      <Spinner animation="border" size="sm" /> Generating...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faSync} /> Generate Report
                    </>
                  )}
                </Button>
                
                {generating && (
                  <div className="mt-3">
                    <ProgressBar now={progress} label={`${progress}%`} />
                    <small className="text-muted">
                      Generating report content using {llmProvider}...
                    </small>
                  </div>
                )}
              </Form>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={8}>
          <Card>
            <Card.Header as="h5">Report Preview</Card.Header>
            <Card.Body>
              <Tabs defaultActiveKey="preview" className="mb-3">
                <Tab eventKey="preview" title="Preview">
                  <div className="border rounded p-3 bg-light">
                    <MarkdownPreview markdown={getPreviewContent()} />
                  </div>
                </Tab>
                <Tab eventKey="raw" title="Raw Markdown">
                  <div className="border rounded p-3">
                    <pre className="m-0" style={{ whiteSpace: 'pre-wrap' }}>
                      {getPreviewContent()}
                    </pre>
                  </div>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ReportGenerator;
