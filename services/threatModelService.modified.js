/**
 * Threat Model Service - Modified Mock Version
 * 
 * A modified version of the threat model service to work with the safeguard report feature.
 * This is a mock implementation that doesn't require a database.
 */

const projectService = require('./projectService');

// Sample threat model data
const mockThreatModels = {
  '5a981710-2e19-47bf-a765-1000af3f871b': [
    {
      id: 't-001',
      project_id: '5a981710-2e19-47bf-a765-1000af3f871b',
      name: 'Customer Data Exposure',
      description: 'Risk of customer PII being exposed due to insufficient access controls',
      impact: 'High',
      likelihood: 'Medium',
      category: 'Data Security',
      created_at: '2025-03-15T10:30:00Z',
      status: 'Active',
      safeguards: [
        { id: 's-001', name: 'Implement data encryption at rest', status: 'Implemented' },
        { id: 's-002', name: 'Apply least privilege access control', status: 'In Progress' },
        { id: 's-003', name: 'Regular security audits', status: 'Not Started' }
      ]
    },
    {
      id: 't-002',
      project_id: '5a981710-2e19-47bf-a765-1000af3f871b',
      name: 'Payment Fraud',
      description: 'Vulnerability to fraudulent payment transactions',
      impact: 'High',
      likelihood: 'Medium',
      category: 'Financial',
      created_at: '2025-03-16T14:45:00Z',
      status: 'Active',
      safeguards: [
        { id: 's-004', name: 'Implement 3D Secure authentication', status: 'Implemented' },
        { id: 's-005', name: 'Transaction monitoring system', status: 'Implemented' },
        { id: 's-006', name: 'Fraud detection algorithms', status: 'In Progress' }
      ]
    },
    {
      id: 't-003',
      project_id: '5a981710-2e19-47bf-a765-1000af3f871b',
      name: 'API Authorization Bypass',
      description: 'Potential for unauthorized API access due to weak authorization',
      impact: 'High',
      likelihood: 'Low',
      category: 'Application Security',
      created_at: '2025-03-17T09:15:00Z',
      status: 'Active',
      safeguards: [
        { id: 's-007', name: 'Implement OAuth 2.0', status: 'Implemented' },
        { id: 's-008', name: 'API request validation', status: 'In Progress' },
        { id: 's-009', name: 'Rate limiting', status: 'Not Started' }
      ]
    }
  ],
  '8c742109-edf1-4376-8a3d-a489c2b4871a': [
    {
      id: 't-004',
      project_id: '8c742109-edf1-4376-8a3d-a489c2b4871a',
      name: 'Patient Data Breach',
      description: 'Unauthorized access to sensitive patient records',
      impact: 'Critical',
      likelihood: 'Low',
      category: 'Data Security',
      created_at: '2025-03-20T08:30:00Z',
      status: 'Active',
      safeguards: [
        { id: 's-010', name: 'HIPAA compliance controls', status: 'Implemented' },
        { id: 's-011', name: 'End-to-end encryption', status: 'In Progress' },
        { id: 's-012', name: 'Access auditing', status: 'Implemented' }
      ]
    }
  ],
  'b4e92d31-f7c8-42e9-b9a5-c87d1e6a9413': [
    {
      id: 't-005',
      project_id: 'b4e92d31-f7c8-42e9-b9a5-c87d1e6a9413',
      name: 'Transaction Manipulation',
      description: 'Risk of financial transactions being altered in transit',
      impact: 'Critical',
      likelihood: 'Low',
      category: 'Financial',
      created_at: '2025-03-25T11:45:00Z',
      status: 'Active',
      safeguards: [
        { id: 's-013', name: 'Transaction signing', status: 'Implemented' },
        { id: 's-014', name: 'Secure communication channels', status: 'Implemented' },
        { id: 's-015', name: 'Transaction verification', status: 'In Progress' }
      ]
    }
  ]
};

/**
 * Get threat models for a project - Mock implementation
 * @param {string} projectId - ID of the project
 * @returns {Promise<Array>} Array of threat models
 */
async function getForProject(projectId) {
  try {
    console.log(`Getting mock threat models for project: ${projectId}`);
    
    // Return mock data for the specified project ID
    return mockThreatModels[projectId] || [];
  } catch (error) {
    console.error(`Error getting mock threat models: ${error.message}`, {
      stack: error.stack,
      projectId
    });
    // Return empty array instead of throwing for resilience
    return [];
  }
}

/**
 * Get a threat model by ID - Mock implementation
 * @param {string} id - ID of the threat model
 * @returns {Promise<Object>} Threat model object
 */
async function getById(id) {
  try {
    // Search through all mock threat models to find the one with the matching ID
    for (const projectId in mockThreatModels) {
      const models = mockThreatModels[projectId];
      const model = models.find(m => m.id === id);
      if (model) {
        return model;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting mock threat model by ID: ${error.message}`, {
      stack: error.stack,
      threatModelId: id
    });
    // Return null instead of throwing for resilience
    return null;
  }
}

/**
 * Get all threat models - Mock implementation
 * @returns {Promise<Array>} Array of all threat models across projects
 */
async function getAllThreatModels() {
  // Flatten all threat models from all projects into a single array
  const allModels = [];
  for (const projectId in mockThreatModels) {
    allModels.push(...mockThreatModels[projectId]);
  }
  return allModels;
}

module.exports = {
  getForProject,
  getById,
  getAllThreatModels,
  mockThreatModels // Expose mock data for testing
};
