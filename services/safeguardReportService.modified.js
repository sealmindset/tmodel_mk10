/**
 * Safeguard Report Service - Enhanced with Analytics
 * 
 * This service handles all operations related to safeguard reports,
 * including generating reports, processing LLM responses, and tracking analytics.
 */

const client = require('../redisClient');
const logger = require('../logger');
const projectService = require('./projectService');
const threatModelService = require('./threatModelService.modified');
const llmAnalysisService = require('./llmAnalysisService');
const analyticsService = require('./analyticsService');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

// Environment variables
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';

/**
 * Generate a safeguard report for a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated report
 */
async function generateReport(projectId, userId, options = {}) {
  const startTime = Date.now();
  let usedLLM = false;
  
  try {
    console.log(`Generating safeguard report for project ${projectId}`, {
      userId,
      projectId,
      options
    });
    
    // Get project details
    const project = await projectService.getById(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    // Get threat models for this project
    const threatModels = await threatModelService.getForProject(projectId);
    if (!threatModels || threatModels.length === 0) {
      throw new Error(`No threat models found for project ${projectId}`);
    }
    
    // Extract all safeguards from threat models
    let allSafeguards = [];
    let allThreats = [];
    
    threatModels.forEach(model => {
      if (model.safeguards && Array.isArray(model.safeguards)) {
        allSafeguards = allSafeguards.concat(model.safeguards.map(s => ({
          ...s,
          modelId: model.id,
          modelName: model.name
        })));
      }
      
      if (model.threats && Array.isArray(model.threats)) {
        allThreats = allThreats.concat(model.threats.map(t => ({
          ...t,
          modelId: model.id,
          modelName: model.name
        })));
      }
    });
    
    let consolidatedSafeguards = allSafeguards;
    let categorizedSafeguards = [];
    let prioritizedSafeguards = [];
    
    // Use LLM to consolidate, categorize, and prioritize safeguards if enabled
    if (options.useLLM && allSafeguards.length > 0) {
      usedLLM = true;
      const llmStartTime = Date.now();
      
      // Track LLM start
      console.log(`Starting LLM processing for project ${projectId}`, {
        userId,
        projectId,
        safeguardCount: allSafeguards.length,
        threatCount: allThreats.length
      });
      
      try {
        // Consolidate safeguards to remove duplicates
        consolidatedSafeguards = await llmAnalysisService.consolidateSafeguards(allSafeguards);
        
        // Categorize safeguards by type and security domain
        categorizedSafeguards = await llmAnalysisService.categorizeSafeguards(consolidatedSafeguards);
        
        // Prioritize safeguards by importance based on threats
        prioritizedSafeguards = await llmAnalysisService.prioritizeSafeguards(
          categorizedSafeguards, 
          allThreats
        );
        
        const llmEndTime = Date.now();
        const llmProcessingTime = llmEndTime - llmStartTime;
        
        // Track LLM processing
        analyticsService.trackLLMResponse(projectId, userId, {
          provider: LLM_PROVIDER,
          model: LLM_PROVIDER === 'openai' ? process.env.OPENAI_MODEL : process.env.OLLAMA_MODEL,
          processingTimeMs: llmProcessingTime,
          errorOccurred: false,
          taskType: 'safeguard_analysis',
          safeguardCount: allSafeguards.length,
          threatCount: allThreats.length,
          consolidatedCount: consolidatedSafeguards.length,
          categorizedCount: categorizedSafeguards.length,
          prioritizedCount: prioritizedSafeguards.length
        });
        
        console.log(`Completed LLM processing for project ${projectId}`, {
          userId,
          projectId,
          processingTimeMs: llmProcessingTime,
          originalSafeguardCount: allSafeguards.length,
          consolidatedSafeguardCount: consolidatedSafeguards.length
        });
      } catch (error) {
        // Track LLM error
        analyticsService.trackLLMResponse(projectId, userId, {
          provider: LLM_PROVIDER,
          model: LLM_PROVIDER === 'openai' ? process.env.OPENAI_MODEL : process.env.OLLAMA_MODEL,
          errorOccurred: true,
          errorMessage: error.message,
          taskType: 'safeguard_analysis',
          safeguardCount: allSafeguards.length
        });
        
        console.error(`Error during LLM processing: ${error.message}`, {
          stack: error.stack,
          userId,
          projectId
        });
        
        // Continue with original safeguards
        categorizedSafeguards = allSafeguards;
        prioritizedSafeguards = allSafeguards;
      }
    } else {
      // No LLM used, use original safeguards
      categorizedSafeguards = allSafeguards;
      prioritizedSafeguards = allSafeguards;
    }
    
    // Generate summary statistics
    const summary = {
      totalSafeguards: allSafeguards.length,
      consolidatedSafeguards: consolidatedSafeguards.length,
      totalThreats: allThreats.length,
      threatModelsCount: threatModels.length,
      usedLLM: usedLLM,
      processingTimeMs: Date.now() - startTime,
      generatedAt: new Date().toISOString(),
      projectName: project.name,
      projectId: project.id
    };
    
    // Build final report
    const report = {
      project,
      summary,
      safeguards: prioritizedSafeguards || categorizedSafeguards || consolidatedSafeguards || allSafeguards,
      metadata: {
        userId,
        generatedAt: new Date().toISOString(),
        usedLLM,
        processingTimeMs: Date.now() - startTime,
        options
      }
    };
    
    // Track report generation
    analyticsService.trackReportGeneration(projectId, userId, {
      usedLLM,
      safeguardCount: allSafeguards.length,
      processingTimeMs: Date.now() - startTime,
      threatModelsCount: threatModels.length,
      source: options.source || 'web'
    });
    
    console.log(`Completed safeguard report generation for project ${projectId}`, {
      userId,
      projectId,
      processingTimeMs: Date.now() - startTime,
      safeguardCount: report.safeguards.length
    });
    
    return report;
  } catch (error) {
    console.error(`Error generating safeguard report: ${error.message}`, {
      stack: error.stack,
      userId,
      projectId
    });
    
    // Track error in report generation
    analyticsService.trackReportGeneration(projectId, userId, {
      error: true,
      errorMessage: error.message,
      usedLLM,
      processingTimeMs: Date.now() - startTime,
      source: options.source || 'web'
    });
    
    throw error;
  }
}

/**
 * Update the implementation status of a safeguard
 * @param {string} projectId - Project ID
 * @param {string} safeguardId - Safeguard ID
 * @param {string} status - New status (Not Started, In Progress, Implemented)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated safeguard
 */
async function updateSafeguardStatus(projectId, safeguardId, status, userId) {
  try {
    console.log(`Updating safeguard ${safeguardId} status to ${status}`, {
      userId,
      projectId,
      safeguardId,
      status
    });
    
    // Get current status to track change
    const getCurrentStatusQuery = `
      SELECT implementation_status 
      FROM safeguard_status 
      WHERE project_id = $1 AND safeguard_id = $2
    `;
    
    const currentStatusResult = await client.query(getCurrentStatusQuery, [projectId, safeguardId]);
    const oldStatus = currentStatusResult.rows[0]?.implementation_status || 'Not Started';
    
    // Update or insert status
    const upsertQuery = `
      INSERT INTO safeguard_status
        (project_id, safeguard_id, implementation_status, updated_by, updated_at)
      VALUES
        ($1, $2, $3, $4, NOW())
      ON CONFLICT (project_id, safeguard_id)
      DO UPDATE SET
        implementation_status = $3,
        updated_by = $4,
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await client.query(upsertQuery, [
      projectId,
      safeguardId,
      status,
      userId
    ]);
    
    // Track status change
    analyticsService.trackStatusChange(
      projectId,
      safeguardId,
      userId,
      oldStatus,
      status,
      { source: 'web' }
    );
    
    console.log(`Successfully updated safeguard ${safeguardId} status to ${status}`, {
      userId,
      projectId,
      safeguardId
    });
    
    return result.rows[0];
  } catch (error) {
    console.error(`Error updating safeguard status: ${error.message}`, {
      stack: error.stack,
      userId,
      projectId,
      safeguardId,
      status
    });
    
    throw error;
  }
}

/**
 * Format report data for export
 * @param {Object} report - Report data
 * @param {string} format - Export format (json, csv, pdf)
 * @returns {Object} Formatted data and metadata
 */
function formatReportForExport(report, format) {
  // Common metadata
  const metadata = {
    title: `Safeguard Report - ${report.project.name}`,
    author: 'Threat Modeling System',
    createdAt: new Date().toISOString(),
    projectId: report.project.id,
    projectName: report.project.name
  };

  // Format safeguards for export
  const formattedSafeguards = report.safeguards.map(s => {
    return {
      id: s.id,
      description: s.description,
      modelName: s.modelName || 'Unknown',
      category: s.category || 'Uncategorized',
      priority: s.priority || 'Medium',
      implementationStatus: s.implementation_status || 'Not Started',
      securityDomain: s.security_domain || 'General'
    };
  });
  
  return {
    metadata,
    data: {
      project: {
        id: report.project.id,
        name: report.project.name,
        description: report.project.description,
        createdAt: report.project.created_at
      },
      summary: report.summary,
      safeguards: formattedSafeguards
    }
  };
}

/**
 * Generate PDF report
 * @param {Object} formattedData - Formatted report data
 * @returns {Promise<Buffer>} PDF document as buffer
 */
async function generatePDFReport(formattedData) {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });
      
      // Collect PDF output in a buffer
      const buffers = [];
      doc.on('data', buffer => buffers.push(buffer));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      
      // Add title and metadata
      doc.info.Title = formattedData.metadata.title;
      doc.info.Author = formattedData.metadata.author;
      doc.info.Creator = 'Threat Modeling Tool';
      
      // Title page
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text(formattedData.metadata.title, { align: 'center' })
         .moveDown(1);
      
      doc.fontSize(14)
         .font('Helvetica')
         .text(`Generated: ${new Date(formattedData.metadata.createdAt).toLocaleString()}`, { align: 'center' })
         .moveDown(0.5);
      
      // Project info
      doc.moveDown(2)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Project Information')
         .moveDown(0.5);
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Name: ${formattedData.data.project.name}`)
         .text(`Description: ${formattedData.data.project.description || 'No description'}`)
         .text(`Created: ${new Date(formattedData.data.project.createdAt).toLocaleString()}`)
         .moveDown(1);
      
      // Summary
      doc.moveDown(1)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Summary')
         .moveDown(0.5);
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(`Total Safeguards: ${formattedData.data.summary.totalSafeguards}`)
         .text(`Consolidated Safeguards: ${formattedData.data.summary.consolidatedSafeguards}`)
         .text(`Total Threats: ${formattedData.data.summary.totalThreats}`)
         .text(`Threat Models: ${formattedData.data.summary.threatModelsCount}`)
         .moveDown(1);
      
      // Add page for safeguards
      doc.addPage();
      
      // Safeguards
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('Safeguards', { align: 'center' })
         .moveDown(1);
      
      // Group safeguards by category
      const safeguardsByCategory = {};
      formattedData.data.safeguards.forEach(s => {
        const category = s.category || 'Uncategorized';
        if (!safeguardsByCategory[category]) {
          safeguardsByCategory[category] = [];
        }
        safeguardsByCategory[category].push(s);
      });
      
      // Add each category and its safeguards
      Object.keys(safeguardsByCategory).forEach(category => {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(category)
           .moveDown(0.5);
        
        // Add each safeguard in this category
        safeguardsByCategory[category].forEach((safeguard, index) => {
          // Add new page if near bottom
          if (doc.y > 700) {
            doc.addPage();
          }
          
          const statusColors = {
            'Not Started': '#FF6347',
            'In Progress': '#FFD700',
            'Implemented': '#32CD32'
          };
          
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text(`${index + 1}. ${safeguard.id}`, { continued: true })
             .font('Helvetica')
             .text(` (${safeguard.priority} Priority)`, { align: 'left' })
             .moveDown(0.2);
          
          doc.fontSize(10)
             .font('Helvetica')
             .text(safeguard.description)
             .moveDown(0.2);
          
          doc.fontSize(10)
             .font('Helvetica')
             .text(`Status: `, { continued: true })
             .fillColor(statusColors[safeguard.implementationStatus] || '#000000')
             .text(safeguard.implementationStatus)
             .fillColor('#000000')
             .text(`Domain: ${safeguard.securityDomain}`)
             .text(`From: ${safeguard.modelName}`)
             .moveDown(0.5);
        });
        
        doc.moveDown(1);
      });
      
      // Finalize the PDF and end the stream
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate CSV export
 * @param {Object} formattedData - Formatted report data
 * @returns {string} CSV content
 */
function generateCSVReport(formattedData) {
  try {
    // Define fields for CSV
    const fields = [
      { label: 'ID', value: 'id' },
      { label: 'Description', value: 'description' },
      { label: 'Category', value: 'category' },
      { label: 'Priority', value: 'priority' },
      { label: 'Implementation Status', value: 'implementationStatus' },
      { label: 'Security Domain', value: 'securityDomain' },
      { label: 'Threat Model', value: 'modelName' }
    ];
    
    // Create CSV parser
    const json2csvParser = new Parser({ fields });
    
    // Convert to CSV
    const csv = json2csvParser.parse(formattedData.data.safeguards);
    
    return csv;
  } catch (error) {
    console.error(`Error generating CSV report: ${error.message}`, {
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Export report to file
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @param {string} format - Export format (json, csv, pdf)
 * @returns {Promise<Object>} Export result with file path
 */
async function exportReport(projectId, userId, format = 'json') {
  try {
    console.log(`Exporting safeguard report for project ${projectId} in ${format} format`, {
      userId,
      projectId,
      format
    });
    
    // Generate report
    const report = await generateReport(projectId, userId, { useLLM: false });
    
    // Format data for export
    const formattedData = formatReportForExport(report, format);
    
    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `safeguard-report-${projectId}-${timestamp}.${format}`;
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, filename);
    
    let result;
    
    // Generate file based on format
    switch (format.toLowerCase()) {
      case 'pdf':
        const pdfBuffer = await generatePDFReport(formattedData);
        await util.promisify(fs.writeFile)(filePath, pdfBuffer);
        result = { filePath, mimeType: 'application/pdf', filename };
        break;
        
      case 'csv':
        const csvContent = generateCSVReport(formattedData);
        await util.promisify(fs.writeFile)(filePath, csvContent);
        result = { filePath, mimeType: 'text/csv', filename };
        break;
        
      case 'json':
      default:
        await util.promisify(fs.writeFile)(filePath, JSON.stringify(formattedData, null, 2));
        result = { filePath, mimeType: 'application/json', filename };
        break;
    }
    
    // Track feature usage
    analyticsService.trackFeatureUsage(`export_report_${format}`, userId, {
      projectId,
      fileSize: fs.statSync(filePath).size,
      format
    });
    
    console.log(`Successfully exported report to ${filePath}`, {
      userId,
      projectId,
      format,
      fileSize: fs.statSync(filePath).size
    });
    
    return result;
  } catch (error) {
    console.error(`Error exporting report: ${error.message}`, {
      stack: error.stack,
      userId,
      projectId,
      format
    });
    
    throw error;
  }
}

module.exports = {
  generateReport,
  updateSafeguardStatus,
  formatReportForExport,
  generatePDFReport,
  generateCSVReport,
  exportReport
};
