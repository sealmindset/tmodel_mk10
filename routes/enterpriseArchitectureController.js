/**
 * Enterprise Architecture Controller
 * 
 * Handles routes for the enhanced enterprise architecture features
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const enterpriseArchitectureService = require('../services/enterpriseArchitectureService');
const pool = require('../db/db');

/**
 * GET /enterprise-architecture/enterprise-dashboard - Show enterprise security dashboard
 */
router.get('/enterprise-dashboard', ensureAuthenticated, async (req, res) => {
  try {
    // Get all projects with security posture
    const projectsQuery = `
      SELECT * FROM threat_model.project_security_posture
      ORDER BY project_name ASC
    `;
    
    const projectsResult = await pool.query(projectsQuery);
    const projects = projectsResult.rows;
    
    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) AS project_count,
        COUNT(DISTINCT c.id) AS component_count,
        COUNT(DISTINCT s.id) AS safeguard_count,
        COUNT(DISTINCT t.id) AS threat_count,
        COUNT(DISTINCT v.id) AS vulnerability_count,
        ROUND(AVG(p.security_posture_score)) AS avg_security_posture_score,
        SUM(p.risk_exposure_value) AS total_risk_exposure_value
      FROM 
        threat_model.projects p
      LEFT JOIN 
        threat_model.project_components pc ON p.id = pc.project_id
      LEFT JOIN 
        threat_model.components c ON pc.component_id = c.id
      LEFT JOIN 
        threat_model.component_safeguards cs ON c.id = cs.component_id
      LEFT JOIN 
        threat_model.safeguards s ON cs.safeguard_id = s.id
      LEFT JOIN 
        threat_model.project_threat_models ptm ON p.id = ptm.project_id
      LEFT JOIN 
        threat_model.threat_models tm ON ptm.threat_model_id = tm.id
      LEFT JOIN 
        threat_model.threats t ON tm.id = t.threat_model_id
      LEFT JOIN 
        threat_model.vulnerabilities v ON c.id = v.component_id
    `;
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    // Get business unit statistics
    const businessUnitQuery = `
      SELECT 
        business_unit,
        COUNT(DISTINCT id) AS project_count,
        ROUND(AVG(security_posture_score)) AS avg_security_posture_score,
        SUM(risk_exposure_value) AS total_risk_exposure_value
      FROM 
        threat_model.projects
      WHERE 
        business_unit IS NOT NULL
      GROUP BY 
        business_unit
      ORDER BY 
        business_unit ASC
    `;
    
    const businessUnitResult = await pool.query(businessUnitQuery);
    const businessUnitStats = businessUnitResult.rows;
    
    // Get component categories statistics
    const componentCategoryQuery = `
      SELECT 
        category,
        COUNT(DISTINCT id) AS component_count
      FROM 
        threat_model.components
      WHERE 
        category IS NOT NULL
      GROUP BY 
        category
      ORDER BY 
        component_count DESC
    `;
    
    const componentCategoryResult = await pool.query(componentCategoryQuery);
    const componentCategoryStats = componentCategoryResult.rows;
    
    // Render the enterprise dashboard
    res.render('enterprise-dashboard', {
      projects,
      stats,
      businessUnitStats,
      componentCategoryStats,
      pageTitle: 'Enterprise Security Dashboard',
      active: 'enterprise-dashboard'
    });
  } catch (error) {
    console.error('Error loading enterprise dashboard:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading enterprise dashboard',
      errorDetails: error.message
    });
  }
});

/**
 * GET /projects/:id/security-posture - Show project security posture
 */
router.get('/projects/:id/security-posture', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Get project details
    const projectQuery = `
      SELECT * FROM threat_model.projects 
      WHERE id = $1
    `;
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Project not found'
      });
    }
    
    const project = projectResult.rows[0];
    
    // Get security posture
    const securityPosture = await enterpriseArchitectureService.getProjectSecurityPosture(projectId);
    
    // Get security metrics history
    const timePeriod = req.query.period || '3m';
    const metricsHistory = await enterpriseArchitectureService.getSecurityMetricsHistory(projectId, timePeriod);
    
    // Get components with business impact analysis
    const componentsQuery = `
      SELECT 
        c.*,
        bia.confidentiality_impact,
        bia.integrity_impact,
        bia.availability_impact,
        bia.financial_impact,
        bia.reputational_impact,
        bia.regulatory_impact,
        bia.analysis_date
      FROM 
        threat_model.components c
      JOIN 
        threat_model.project_components pc ON c.id = pc.component_id
      LEFT JOIN 
        threat_model.business_impact_analysis bia ON c.id = bia.component_id AND bia.project_id = pc.project_id
      WHERE 
        pc.project_id = $1
      ORDER BY 
        c.name ASC
    `;
    
    const componentsResult = await pool.query(componentsQuery, [projectId]);
    const components = componentsResult.rows;
    
    // Render the project security posture page
    res.render('project-security-posture', {
      project,
      securityPosture,
      metricsHistory,
      components,
      timePeriod,
      pageTitle: `${project.name} - Security Posture`,
      active: 'projects'
    });
  } catch (error) {
    console.error('Error loading project security posture:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading project security posture',
      errorDetails: error.message
    });
  }
});

/**
 * GET /vulnerabilities - Show all vulnerabilities
 */
router.get('/vulnerabilities', ensureAuthenticated, async (req, res) => {
  try {
    // Get all vulnerabilities across projects
    const vulnerabilitiesQuery = `
      SELECT v.*, p.name as project_name, c.name as component_name
      FROM threat_model.vulnerabilities v
      LEFT JOIN threat_model.components c ON v.component_id = c.id
      LEFT JOIN threat_model.project_components pc ON c.id = pc.component_id
      LEFT JOIN threat_model.projects p ON pc.project_id = p.id
      ORDER BY v.severity DESC, v.created_at DESC
    `;
    
    const vulnerabilitiesResult = await pool.query(vulnerabilitiesQuery);
    const vulnerabilities = vulnerabilitiesResult.rows;
    
    // Calculate vulnerability summary
    const vulnerabilitySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      inProgress: 0,
      remediated: 0,
      acceptedRisk: 0,
      total: vulnerabilities.length
    };
    
    vulnerabilities.forEach(vuln => {
      // Count by severity
      if (vuln.severity === 'Critical') vulnerabilitySummary.critical++;
      else if (vuln.severity === 'High') vulnerabilitySummary.high++;
      else if (vuln.severity === 'Medium') vulnerabilitySummary.medium++;
      else vulnerabilitySummary.low++;
      
      // Count by status
      if (vuln.status === 'Open') vulnerabilitySummary.open++;
      else if (vuln.status === 'In Progress') vulnerabilitySummary.inProgress++;
      else if (vuln.status === 'Remediated') vulnerabilitySummary.remediated++;
      else if (vuln.status === 'Accepted Risk') vulnerabilitySummary.acceptedRisk++;
    });
    
    res.render('all-vulnerabilities', {
      vulnerabilities,
      vulnerabilitySummary,
      pageTitle: 'All Vulnerabilities',
      active: 'vulnerabilities'
    });
  } catch (error) {
    console.error('Error loading vulnerabilities:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading vulnerabilities',
      errorDetails: error.message
    });
  }
});

/**
 * GET /projects/:id/vulnerabilities - Show project vulnerabilities
 */
router.get('/projects/:id/vulnerabilities', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Get project details
    const projectQuery = `
      SELECT * FROM threat_model.projects 
      WHERE id = $1
    `;
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Project not found',
        errorDetails: `Project with ID ${projectId} does not exist`
      });
    }
    
    const project = projectResult.rows[0];
    
    // Get vulnerabilities for the project
    const vulnerabilities = await enterpriseArchitectureService.getProjectVulnerabilities(projectId);
    
    // Calculate vulnerability summary
    const vulnerabilitySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      open: 0,
      inProgress: 0,
      remediated: 0,
      acceptedRisk: 0,
      total: vulnerabilities.length
    };
    
    vulnerabilities.forEach(vuln => {
      // Count by severity
      if (vuln.severity === 'Critical') vulnerabilitySummary.critical++;
      else if (vuln.severity === 'High') vulnerabilitySummary.high++;
      else if (vuln.severity === 'Medium') vulnerabilitySummary.medium++;
      else vulnerabilitySummary.low++;
      
      // Count by status
      if (vuln.status === 'Open') vulnerabilitySummary.open++;
      else if (vuln.status === 'In Progress') vulnerabilitySummary.inProgress++;
      else if (vuln.status === 'Remediated') vulnerabilitySummary.remediated++;
      else if (vuln.status === 'Accepted Risk') vulnerabilitySummary.acceptedRisk++;
    });
    
    // Get last sync time
    const lastSync = project.last_vulnerability_sync;
    
    res.render('project-vulnerabilities', {
      project,
      vulnerabilities,
      vulnerabilitySummary,
      lastSync,
      pageTitle: `${project.name} - Vulnerabilities`,
      active: 'projects'
    });
  } catch (error) {
    console.error('Error loading project vulnerabilities:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading project vulnerabilities',
      errorDetails: error.message
    });
  }
});

/**
 * POST /projects/:id/security-posture/update - Update project security posture
 */
router.post('/projects/:id/security-posture/update', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Update security posture score
    const score = await enterpriseArchitectureService.updateProjectSecurityPostureScore(projectId);
    
    res.json({
      success: true,
      score
    });
  } catch (error) {
    console.error('Error updating project security posture:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /component-library - Show component library
 */
router.get('/component-library', ensureAuthenticated, async (req, res) => {
  try {
    // Get filters from query string
    const { category, name } = req.query;
    
    // Get component library items
    const libraryItems = await enterpriseArchitectureService.getComponentLibrary({ category, name });
    
    // Get categories for filter dropdown
    const categoriesQuery = `
      SELECT DISTINCT category
      FROM threat_model.component_library
      WHERE category IS NOT NULL
      ORDER BY category ASC
    `;
    
    const categoriesResult = await pool.query(categoriesQuery);
    const categories = categoriesResult.rows.map(row => row.category);
    
    // Render the component library page
    res.render('component-library', {
      libraryItems,
      categories,
      filters: {
        category,
        name
      },
      pageTitle: 'Component Library',
      active: 'component-library'
    });
  } catch (error) {
    console.error('Error loading component library:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading component library',
      errorDetails: error.message
    });
  }
});

/**
 * GET /safeguard-library - Show safeguard library
 */
router.get('/safeguard-library', ensureAuthenticated, async (req, res) => {
  try {
    // Get filters from query string
    const { category, name } = req.query;
    
    // Get safeguard library items
    const libraryItems = await enterpriseArchitectureService.getSafeguardLibrary({ category, name });
    
    // Get categories for filter dropdown
    const categoriesQuery = `
      SELECT DISTINCT category
      FROM threat_model.safeguard_library
      WHERE category IS NOT NULL
      ORDER BY category ASC
    `;
    
    const categoriesResult = await pool.query(categoriesQuery);
    const categories = categoriesResult.rows.map(row => row.category);
    
    // Render the safeguard library page
    res.render('safeguard-library', {
      libraryItems,
      categories,
      filters: {
        category,
        name
      },
      pageTitle: 'Safeguard Library',
      active: 'safeguard-library'
    });
  } catch (error) {
    console.error('Error loading safeguard library:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading safeguard library',
      errorDetails: error.message
    });
  }
});

/**
 * API Routes
 */

/**
 * POST /api/components/create-from-library - Create component from library
 */
router.post('/api/components/create-from-library', ensureAuthenticated, async (req, res) => {
  try {
    const { libraryItemId, componentData } = req.body;
    
    if (!libraryItemId) {
      return res.status(400).json({
        success: false,
        error: 'Library item ID is required'
      });
    }
    
    // Add username to component data
    componentData.created_by = req.session?.username || 'system';
    
    // Create component from library
    const component = await enterpriseArchitectureService.createComponentFromLibrary(libraryItemId, componentData);
    
    res.json({
      success: true,
      component
    });
  } catch (error) {
    console.error('Error creating component from library:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/projects/:projectId/components/:componentId/business-impact - Update business impact analysis
 */
router.post('/api/projects/:projectId/components/:componentId/business-impact', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    const impactData = req.body;
    
    // Add username to impact data
    impactData.created_by = req.session?.username || 'system';
    
    // Update business impact analysis
    const impact = await enterpriseArchitectureService.updateBusinessImpactAnalysis(projectId, componentId, impactData);
    
    res.json({
      success: true,
      impact
    });
  } catch (error) {
    console.error('Error updating business impact analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/components/:componentId/rapid7-mapping - Map component to Rapid7 asset
 */
router.post('/api/components/:componentId/rapid7-mapping', ensureAuthenticated, async (req, res) => {
  try {
    const { componentId } = req.params;
    const { rapid7AssetId, rapid7AssetName } = req.body;
    
    if (!rapid7AssetId) {
      return res.status(400).json({
        success: false,
        error: 'Rapid7 asset ID is required'
      });
    }
    
    // Map component to Rapid7 asset
    const mapping = await enterpriseArchitectureService.mapComponentToRapid7Asset(componentId, rapid7AssetId, rapid7AssetName);
    
    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error('Error mapping component to Rapid7 asset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/projects/:projectId/sync-vulnerabilities - Sync vulnerabilities for a project
 */
router.post('/api/projects/:projectId/sync-vulnerabilities', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Sync vulnerabilities for the project
    const result = await enterpriseArchitectureService.syncProjectVulnerabilities(projectId);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error syncing project vulnerabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/projects/:projectId/vulnerabilities - Get vulnerabilities for a project
 */
router.get('/api/projects/:projectId/vulnerabilities', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get vulnerabilities for the project
    const vulnerabilities = await enterpriseArchitectureService.getProjectVulnerabilities(projectId);
    
    res.json({
      success: true,
      vulnerabilities
    });
  } catch (error) {
    console.error('Error getting project vulnerabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/vulnerabilities/:vulnerabilityId/status - Update vulnerability status
 */
router.put('/api/vulnerabilities/:vulnerabilityId/status', ensureAuthenticated, async (req, res) => {
  try {
    const { vulnerabilityId } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    // Update vulnerability status
    const vulnerability = await enterpriseArchitectureService.updateVulnerabilityStatus(
      vulnerabilityId,
      status,
      notes
    );
    
    res.json({
      success: true,
      vulnerability
    });
  } catch (error) {
    console.error('Error updating vulnerability status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/components/:componentId/rapid7-mappings - Get Rapid7 asset mappings for a component
 */
router.get('/api/components/:componentId/rapid7-mappings', ensureAuthenticated, async (req, res) => {
  try {
    const { componentId } = req.params;
    
    // Get Rapid7 asset mappings
    const mappings = await enterpriseArchitectureService.getRapid7AssetMappings(componentId);
    
    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    console.error('Error getting Rapid7 asset mappings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/projects/:id/security-metrics - Get security metrics history for a project
 */
router.get('/api/projects/:id/security-metrics', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const timePeriod = req.query.period || '3m';
    
    // Get security metrics history
    const metrics = await enterpriseArchitectureService.getSecurityMetricsHistory(projectId, timePeriod);
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Error getting security metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/component-library - Get component library items
 */
router.get('/api/component-library', ensureAuthenticated, async (req, res) => {
  try {
    // Get filters from query string
    const { category, name } = req.query;
    
    // Get component library items
    const components = await enterpriseArchitectureService.getComponentLibraryItems(category, name);
    
    res.json({
      success: true,
      components
    });
  } catch (error) {
    console.error('Error getting component library items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/component-library - Add component to library
 */
router.post('/api/component-library', ensureAuthenticated, async (req, res) => {
  try {
    const componentData = req.body;
    
    // Add username to component data
    componentData.created_by = req.session?.username || 'system';
    
    // Add component to library
    const component = await enterpriseArchitectureService.addComponentToLibrary(componentData);
    
    res.json({
      success: true,
      component
    });
  } catch (error) {
    console.error('Error adding component to library:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/component-library/:id - Delete component from library
 */
router.delete('/api/component-library/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete component from library
    await enterpriseArchitectureService.deleteComponentFromLibrary(id);
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting component from library:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/safeguard-library - Get safeguard library items
 */
router.get('/api/safeguard-library', ensureAuthenticated, async (req, res) => {
  try {
    // Get filters from query string
    const { category, name } = req.query;
    
    // Get safeguard library items
    const safeguards = await enterpriseArchitectureService.getSafeguardLibraryItems(category, name);
    
    res.json({
      success: true,
      safeguards
    });
  } catch (error) {
    console.error('Error getting safeguard library items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/safeguard-library - Add safeguard to library
 */
router.post('/api/safeguard-library', ensureAuthenticated, async (req, res) => {
  try {
    const safeguardData = req.body;
    
    // Add username to safeguard data
    safeguardData.created_by = req.session?.username || 'system';
    
    // Add safeguard to library
    const safeguard = await enterpriseArchitectureService.addSafeguardToLibrary(safeguardData);
    
    res.json({
      success: true,
      safeguard
    });
  } catch (error) {
    console.error('Error adding safeguard to library:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/safeguard-library/:id - Delete safeguard from library
 */
router.delete('/api/safeguard-library/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete safeguard from library
    await enterpriseArchitectureService.deleteSafeguardFromLibrary(id);
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting safeguard from library:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/projects/:id/security-posture/update - Update project security posture
 */
router.post('/api/projects/:id/security-posture/update', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Update project security posture
    const securityPosture = await enterpriseArchitectureService.updateProjectSecurityPosture(projectId);
    
    res.json({
      success: true,
      score: securityPosture.security_posture_score
    });
  } catch (error) {
    console.error('Error updating project security posture:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/component-library/:id - Get component library item by ID
 */
router.get('/api/component-library/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get component library item
    const component = await enterpriseArchitectureService.getComponentLibraryItem(id);
    
    res.json({
      success: true,
      component
    });
  } catch (error) {
    console.error('Error getting component library item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/component-library/:id - Update component library item
 */
router.put('/api/component-library/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const componentData = req.body;
    
    // Update component library item
    const component = await enterpriseArchitectureService.updateComponentLibraryItem(id, componentData);
    
    res.json({
      success: true,
      component
    });
  } catch (error) {
    console.error('Error updating component library item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/safeguard-library/:id - Get safeguard library item by ID
 */
router.get('/api/safeguard-library/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get safeguard library item
    const safeguard = await enterpriseArchitectureService.getSafeguardLibraryItem(id);
    
    res.json({
      success: true,
      safeguard
    });
  } catch (error) {
    console.error('Error getting safeguard library item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/safeguard-library/:id - Update safeguard library item
 */
router.put('/api/safeguard-library/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const safeguardData = req.body;
    
    // Update safeguard library item
    const safeguard = await enterpriseArchitectureService.updateSafeguardLibraryItem(id, safeguardData);
    
    res.json({
      success: true,
      safeguard
    });
  } catch (error) {
    console.error('Error updating safeguard library item:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/projects/:id/sync-vulnerabilities - Sync vulnerabilities for a project
 */
router.post('/api/projects/:id/sync-vulnerabilities', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Get project details
    const projectQuery = `
      SELECT * FROM threat_model.projects 
      WHERE id = $1
    `;
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Sync vulnerabilities
    await enterpriseArchitectureService.syncProjectVulnerabilities(projectId);
    
    // Get updated vulnerabilities
    const vulnerabilities = await enterpriseArchitectureService.getProjectVulnerabilities(projectId);
    
    res.json({
      success: true,
      message: 'Vulnerabilities synced successfully',
      count: vulnerabilities.length
    });
  } catch (error) {
    console.error('Error syncing vulnerabilities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /vulnerabilities/:id - Show vulnerability details
 */
router.get('/vulnerabilities/:id', ensureAuthenticated, async (req, res) => {
  try {
    const vulnerabilityId = req.params.id;
    
    // Get vulnerability details
    const vulnerabilityQuery = `
      SELECT v.*, p.name as project_name, p.id as project_id, c.name as component_name
      FROM threat_model.vulnerabilities v
      LEFT JOIN threat_model.components c ON v.component_id = c.id
      LEFT JOIN threat_model.project_components pc ON c.id = pc.component_id
      LEFT JOIN threat_model.projects p ON pc.project_id = p.id
      WHERE v.id = $1
    `;
    
    const vulnerabilityResult = await pool.query(vulnerabilityQuery, [vulnerabilityId]);
    
    if (vulnerabilityResult.rows.length === 0) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Vulnerability not found',
        errorDetails: `Vulnerability with ID ${vulnerabilityId} does not exist`
      });
    }
    
    const vulnerability = vulnerabilityResult.rows[0];
    
    // Get vulnerability history
    const historyQuery = `
      SELECT * FROM threat_model.vulnerability_history
      WHERE vulnerability_id = $1
      ORDER BY created_at DESC
    `;
    
    const historyResult = await pool.query(historyQuery, [vulnerabilityId]);
    const history = historyResult.rows;
    
    res.render('vulnerability-details', {
      vulnerability,
      history,
      pageTitle: `Vulnerability: ${vulnerability.title}`,
      active: 'vulnerabilities'
    });
  } catch (error) {
    console.error('Error loading vulnerability details:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading vulnerability details',
      errorDetails: error.message
    });
  }
});

/**
 * PUT /api/vulnerabilities/:id/status - Update vulnerability status
 */
router.put('/api/vulnerabilities/:id/status', ensureAuthenticated, async (req, res) => {
  try {
    const vulnerabilityId = req.params.id;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    // Validate status
    const validStatuses = ['Open', 'In Progress', 'Remediated', 'Accepted Risk'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Update vulnerability status
    const updatedVulnerability = await enterpriseArchitectureService.updateVulnerabilityStatus(
      vulnerabilityId,
      status,
      notes,
      req.session?.username || 'system'
    );
    
    res.json({
      success: true,
      vulnerability: updatedVulnerability
    });
  } catch (error) {
    console.error('Error updating vulnerability status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
