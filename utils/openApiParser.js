/**
 * OpenAPI Parser Utility
 * 
 * Parses OpenAPI JSON files and extracts useful information
 */
const fs = require('fs');
const path = require('path');

/**
 * Parse an OpenAPI JSON file and extract key information
 * 
 * @param {string} filePath - Path to the OpenAPI JSON file
 * @returns {Object} - Extracted information from the OpenAPI spec
 */
async function parseOpenApiJson(filePath) {
  try {
    console.log('Parsing OpenAPI file:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return {
        success: false,
        error: 'File not found: ' + filePath
      };
    }
    
    // Read the file with error handling
    let fileContent;
    try {
      fileContent = await fs.promises.readFile(filePath, 'utf8');
      console.log('File read successfully, size:', fileContent.length);
    } catch (readError) {
      console.error('Error reading file:', readError);
      return {
        success: false,
        error: 'Error reading file: ' + readError.message
      };
    }
    
    // Parse JSON with error handling
    let openApiSpec;
    try {
      openApiSpec = JSON.parse(fileContent);
      console.log('JSON parsed successfully');
      
      // Validate that this is an OpenAPI specification
      if (!openApiSpec.openapi && !openApiSpec.swagger) {
        throw new Error('The file does not appear to be a valid OpenAPI specification');
      }
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      return {
        success: false,
        error: 'Invalid JSON format: ' + parseError.message
      };
    }
    
    // Create info object with safe defaults
    const info = {
      title: 'Unknown API',
      version: 'Unknown',
      description: '',
      baseUrl: '',
      endpoints: []
    };
    
    // Safely extract basic information
    try {
      if (openApiSpec.info) {
        if (openApiSpec.info.title) info.title = String(openApiSpec.info.title);
        if (openApiSpec.info.version) info.version = String(openApiSpec.info.version);
        if (openApiSpec.info.description) info.description = String(openApiSpec.info.description);
      }
      
      // Extract base URL with fallbacks
      if (openApiSpec.servers && Array.isArray(openApiSpec.servers) && openApiSpec.servers.length > 0) {
        if (openApiSpec.servers[0].url) {
          // Get the base URL
          let baseUrl = String(openApiSpec.servers[0].url);
          
          // Define the relaxed pattern that allows both /vm/ and /vm/vX/
          const serverUrlPattern = /^https?:\/\/[\w.-]+\/vm(\/v\d+)?\/?(.*)?$/;
          
          // Validate the URL format using the relaxed pattern
          if (serverUrlPattern.test(baseUrl)) {
            console.log('Server URL matches expected Rapid7 API pattern');
            
            // Normalize the URL to ensure it ends with a slash
            if (!baseUrl.endsWith('/')) {
              baseUrl += '/';
            }
          } else {
            console.warn('Server URL does not match expected Rapid7 API pattern. Using as-is:', baseUrl);
          }
          
          info.baseUrl = baseUrl;
        }
      }
      
      console.log('Extracted basic info:', { title: info.title, version: info.version, baseUrl: info.baseUrl });
    } catch (infoError) {
      console.error('Error extracting basic info:', infoError);
      // Continue with defaults
    }
    
    // Safely extract endpoints
    try {
      if (openApiSpec.paths && typeof openApiSpec.paths === 'object') {
        for (const [path, methods] of Object.entries(openApiSpec.paths)) {
          if (!methods || typeof methods !== 'object') continue;
          
          for (const [method, details] of Object.entries(methods)) {
            // Only process standard HTTP methods
            if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
              try {
                const endpoint = {
                  path: String(path),
                  method: String(method).toUpperCase(),
                  summary: '',
                  description: '',
                  operationId: '',
                  tags: []
                };
                
                // Safely extract endpoint details
                if (details) {
                  if (details.summary) endpoint.summary = String(details.summary);
                  if (details.description) endpoint.description = String(details.description);
                  if (details.operationId) endpoint.operationId = String(details.operationId);
                  if (details.tags && Array.isArray(details.tags)) {
                    endpoint.tags = details.tags.map(tag => String(tag));
                  }
                }
                
                info.endpoints.push(endpoint);
              } catch (endpointError) {
                console.error('Error processing endpoint:', path, method, endpointError);
                // Skip this endpoint and continue
              }
            }
          }
        }
      }
      
      console.log(`Extracted ${info.endpoints.length} endpoints`);
    } catch (pathsError) {
      console.error('Error extracting endpoints:', pathsError);
      // Continue with empty endpoints array
    }
    
    // Safely extract security schemes
    try {
      if (openApiSpec.components && openApiSpec.components.securitySchemes) {
        info.securitySchemes = openApiSpec.components.securitySchemes;
      } else if (openApiSpec.securityDefinitions) {
        // Support for Swagger 2.0
        info.securitySchemes = openApiSpec.securityDefinitions;
      }
    } catch (securityError) {
      console.error('Error extracting security schemes:', securityError);
      // Continue without security schemes
    }
    
    console.log('OpenAPI parsing completed successfully');
    return {
      success: true,
      info
    };
  } catch (error) {
    console.error('Unexpected error parsing OpenAPI JSON:', error);
    return {
      success: false,
      error: 'Error parsing OpenAPI file: ' + error.message
    };
  }
}

module.exports = {
  parseOpenApiJson
};
