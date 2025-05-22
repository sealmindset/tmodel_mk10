/**
 * Safeguard Report Routes - Enhanced with Analytics
 * 
 * This file contains all routes related to safeguard reports,
 * including report generation, export, and analytics.
 */

const express = require('express');
const router = express.Router();
const safeguardReportService = require('../services/safeguardReportService.modified');
const analyticsService = require('../services/analyticsService');
const projectService = require('../services/projectService');
const logger = require('../logger');
const path = require('path');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');

// Middleware for authentication
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Middleware for admin role
const ensureAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Forbidden: Admin access required');
};

// Helper function to generate ETag for data
const generateETag = (data) => {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
};

// Route to show project selection page
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous-user';
    
    logger.info('Rendering project selection page for safeguard report', {
      userId
    });
    
    // Get all projects
    const projects = await projectService.getAllProjects();
    
    // Track feature usage
    analyticsService.trackFeatureUsage('view_project_selection', userId, {
      source: 'web'
    });
    
    res.render('safeguard-report/project-selection', {
      user: req.user,
      projects,
      title: 'Select Project for Safeguard Report'
    });
  } catch (error) {
    logger.error(`Error rendering project selection page: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).send('Error loading the project selection page');
  }
});

// Route to render the report page
router.get('/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id || 'anonymous-user';
    
    logger.info(`Rendering safeguard report page for project ${projectId}`, {
      userId,
      projectId
    });
    
    // Track feature usage
    analyticsService.trackFeatureUsage('view_safeguard_report', userId, {
      projectId,
      source: 'web'
    });
    
    res.render('safeguard-report/report', {
      user: req.user,
      projectId,
      title: 'Safeguard Report'
    });
  } catch (error) {
    logger.error(`Error rendering report page: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id,
      projectId: req.params.projectId
    });
    
    res.status(500).send('Error loading the report page');
  }
});

// Route to get report data with caching support
router.get('/:projectId/data', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id || 'anonymous-user';
    const useLLM = req.query.useLLM === 'true';
    
    logger.info(`Fetching safeguard report data for project ${projectId}`, {
      userId,
      projectId,
      useLLM
    });
    
    // Generate the report
    const report = await safeguardReportService.generateReport(
      projectId,
      userId,
      { 
        useLLM,
        source: 'api'
      }
    );
    
    // Generate ETag for cache validation
    const etag = generateETag(report);
    res.setHeader('ETag', etag);
    
    // Check if client has a valid cached version
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    
    // Set cache control headers
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching report data: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Route to check LLM processing status
router.get('/:projectId/status', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id || 'anonymous-user';
    
    // In a more complex implementation, we would check a queue or database
    // for the actual status. This is a simplified version.
    const status = {
      projectId,
      status: 'completed', // or 'processing', 'failed'
      progress: 100,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    logger.error(`Error checking LLM status: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id,
      projectId: req.params.projectId
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route to update safeguard status
router.post('/:projectId/safeguard/:safeguardId/status', async (req, res) => {
  try {
    const { projectId, safeguardId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id || 'anonymous-user';
    
    if (!status || !['Not Started', 'In Progress', 'Implemented'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: Not Started, In Progress, Implemented'
      });
    }
    
    logger.info(`Updating safeguard status for ${safeguardId} to ${status}`, {
      userId,
      projectId,
      safeguardId,
      status
    });
    
    const result = await safeguardReportService.updateSafeguardStatus(
      projectId,
      safeguardId,
      status,
      userId
    );
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error(`Error updating safeguard status: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id,
      projectId: req.params.projectId,
      safeguardId: req.params.safeguardId
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route to export report in different formats
router.get('/:projectId/export/:format', async (req, res) => {
  try {
    const { projectId, format } = req.params;
    const userId = req.user?.id || 'anonymous-user';
    
    if (!['json', 'csv', 'pdf'].includes(format.toLowerCase())) {
      return res.status(400).send('Invalid format. Supported formats: json, csv, pdf');
    }
    
    logger.info(`Exporting safeguard report for project ${projectId} in ${format} format`, {
      userId,
      projectId,
      format
    });
    
    // Generate the export
    const result = await safeguardReportService.exportReport(
      projectId,
      userId,
      format.toLowerCase()
    );
    
    // Set content headers
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);
    
    // Clean up the temp file when done
    fileStream.on('end', () => {
      fs.unlink(result.filePath, (err) => {
        if (err) {
          logger.error(`Error deleting temp file: ${err.message}`, {
            filePath: result.filePath
          });
        }
      });
    });
  } catch (error) {
    logger.error(`Error exporting report: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id,
      projectId: req.params.projectId,
      format: req.params.format
    });
    
    res.status(500).send(`Export failed: ${error.message}`);
  }
});

// Routes for analytics dashboard
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous-user';
    
    logger.info('Accessing analytics dashboard', {
      userId
    });
    
    // Track feature usage
    analyticsService.trackFeatureUsage('view_analytics_dashboard', userId);
    
    res.render('safeguard-report/analytics-dashboard', {
      user: req.user,
      title: 'Analytics Dashboard'
    });
  } catch (error) {
    logger.error(`Error rendering analytics dashboard: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).send('Error loading the analytics dashboard');
  }
});

// API route to get analytics data
router.get('/analytics/data', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous-user';
    const days = parseInt(req.query.days) || 30;
    const projectId = req.query.projectId; // Optional project filter
    
    logger.info('Fetching analytics data', {
      userId,
      days,
      projectId
    });
    
    // Get all relevant stats
    const [reportStats, llmStats, statusStats] = await Promise.all([
      analyticsService.getReportGenerationStats(projectId, days),
      analyticsService.getLLMResponseStats(projectId, days),
      analyticsService.getStatusChangeStats(projectId, days)
    ]);
    
    res.json({
      success: true,
      data: {
        reportGeneration: reportStats,
        llmResponse: llmStats,
        statusChanges: statusStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching analytics data: ${error.message}`, {
      stack: error.stack,
      userId: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  logger.error(`Safeguard report route error: ${err.message}`, {
    stack: err.stack,
    userId: req.user?.id,
    path: req.path
  });
  
  // Don't expose error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).send('An error occurred');
  } else {
    res.status(500).send(`Error: ${err.message}`);
  }
});

module.exports = router;
