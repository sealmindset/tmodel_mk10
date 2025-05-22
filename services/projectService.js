/**
 * Project Service - Mock Implementation
 * 
 * A mock implementation of the project service that uses sample data
 * instead of querying the database.
 */

const logger = require('../logger');

// Sample project data
const mockProjects = {
  '5a981710-2e19-47bf-a765-1000af3f871b': {
    id: '5a981710-2e19-47bf-a765-1000af3f871b',
    name: 'E-Commerce Platform',
    description: 'An online retail platform with payment processing and user accounts',
    created_at: '2025-01-15T08:30:00Z',
    owner_id: 'user-123',
    status: 'active'
  },
  '8c742109-edf1-4376-8a3d-a489c2b4871a': {
    id: '8c742109-edf1-4376-8a3d-a489c2b4871a',
    name: 'Healthcare Portal',
    description: 'Patient management system with secure data handling',
    created_at: '2025-02-20T14:45:00Z',
    owner_id: 'user-456',
    status: 'active'
  },
  'b4e92d31-f7c8-42e9-b9a5-c87d1e6a9413': {
    id: 'b4e92d31-f7c8-42e9-b9a5-c87d1e6a9413',
    name: 'Banking Application',
    description: 'Financial services app with transaction processing',
    created_at: '2025-03-10T09:15:00Z',
    owner_id: 'user-789',
    status: 'active'
  }
};

/**
 * Get a project by ID - Mock implementation
 * @param {string} id - The project ID
 * @returns {Promise<Object>} Project object
 */
async function getById(id) {
  try {
    console.log(`Getting mock project with ID: ${id}`);
    
    // Return mock project by ID
    const project = mockProjects[id] || null;
    
    if (!project) {
      return null;
    }
    
    return project;
  } catch (error) {
    console.error(`Error getting mock project: ${error.message}`, { 
      stack: error.stack,
      projectId: id 
    });
    // Return null instead of throwing to make this more resilient
    return null;
  }
}

/**
 * Count threat models for a project - Mock implementation
 * @param {string} projectId - The project ID
 * @returns {Promise<number>} Count of threat models
 */
async function countThreatModels(projectId) {
  // Return fake counts based on the project ID to make the data seem realistic
  const mockCounts = {
    '5a981710-2e19-47bf-a765-1000af3f871b': 5,
    '8c742109-edf1-4376-8a3d-a489c2b4871a': 3,
    'b4e92d31-f7c8-42e9-b9a5-c87d1e6a9413': 7
  };
  
  return mockCounts[projectId] || 0;
}

/**
 * Get all projects - Mock implementation
 * @returns {Promise<Array>} Array of projects
 */
async function getAllProjects() {
  return Object.values(mockProjects);
}

module.exports = {
  getById,
  countThreatModels,
  getAllProjects,
  mockProjects // Expose mock data for testing
};
