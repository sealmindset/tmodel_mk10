/**
 * Report Export API Routes
 *
 * Provides endpoints for exporting reports in PDF and Excel formats
 */

const express = require('express');
const { getReportExporter } = require('../utils/reportExporter');
const { ReportRunner } = require('../reporting/reportRunner');
const router = express.Router();

// Initialize report exporter
const reportExporter = getReportExporter({
    tempDir: './temp'
});

// POST /api/reports/export/pdf - Export report as PDF
router.post('/export/pdf', async (req, res) => {
    try {
        const { reportType, templateId, filters, options } = req.body;

        // Validate required fields
        if (!reportType || !templateId) {
            return res.status(400).json({
                error: 'Missing required fields: reportType and templateId'
            });
        }

        console.log(`[ExportAPI] Starting PDF export for ${reportType}`);

        // Generate the report data first
        const reportResult = await ReportRunner.generateReport(reportType, templateId, filters || {});

        // Prepare export data
        const exportData = {
            metadata: {
                reportType,
                templateName: templateId,
                generatedAt: new Date().toISOString(),
                projectName: filters?.projectName || null
            },
            statistics: {
                totalComponents: reportResult.components?.length || 0,
                totalThreats: reportResult.threats?.length || 0,
                totalVulnerabilities: reportResult.vulnerabilities?.length || 0
            },
            projects: reportResult.projects || [],
            components: reportResult.components || [],
            threats: reportResult.threats || [],
            vulnerabilities: reportResult.vulnerabilities || [],
            safeguards: reportResult.safeguards || {}
        };

        // Generate PDF
        const pdfBuffer = await reportExporter.exportToPDF(exportData, options || {});

        // Set response headers
        const filename = `report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        console.log(`[ExportAPI] PDF export completed: ${filename}`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('[ExportAPI] PDF export failed:', error);
        res.status(500).json({
            error: 'PDF export failed',
            details: error.message
        });
    }
});

// POST /api/reports/export/excel - Export report as Excel
router.post('/export/excel', async (req, res) => {
    try {
        const { reportType, templateId, filters, options } = req.body;

        // Validate required fields
        if (!reportType || !templateId) {
            return res.status(400).json({
                error: 'Missing required fields: reportType and templateId'
            });
        }

        console.log(`[ExportAPI] Starting Excel export for ${reportType}`);

        // Generate the report data first
        const reportResult = await ReportRunner.generateReport(reportType, templateId, filters || {});

        // Prepare export data
        const exportData = {
            metadata: {
                reportType,
                templateName: templateId,
                generatedAt: new Date().toISOString(),
                projectName: filters?.projectName || null
            },
            statistics: {
                totalComponents: reportResult.components?.length || 0,
                totalThreats: reportResult.threats?.length || 0,
                totalVulnerabilities: reportResult.vulnerabilities?.length || 0
            },
            projects: reportResult.projects || [],
            components: reportResult.components || [],
            threats: reportResult.threats || [],
            vulnerabilities: reportResult.vulnerabilities || [],
            safeguards: reportResult.safeguards || {}
        };

        // Generate Excel
        const excelBuffer = await reportExporter.exportToExcel(exportData, options || {});

        // Set response headers
        const filename = `report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', excelBuffer.length);

        console.log(`[ExportAPI] Excel export completed: ${filename}`);
        res.send(excelBuffer);

    } catch (error) {
        console.error('[ExportAPI] Excel export failed:', error);
        res.status(500).json({
            error: 'Excel export failed',
            details: error.message
        });
    }
});

// GET /api/reports/export/formats - Get available export formats
router.get('/export/formats', async (req, res) => {
    try {
        const formats = [
            {
                id: 'pdf',
                name: 'PDF Document',
                description: 'Professional PDF document with formatted tables and styling',
                contentType: 'application/pdf',
                extension: 'pdf',
                features: ['Formatted tables', 'Professional styling', 'Print-ready', 'Metadata included']
            },
            {
                id: 'excel',
                name: 'Excel Spreadsheet',
                description: 'Structured Excel file with multiple worksheets for different data types',
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                extension: 'xlsx',
                features: ['Multiple worksheets', 'Conditional formatting', 'Data analysis', 'Filtering']
            }
        ];

        res.json({
            success: true,
            data: formats
        });

    } catch (error) {
        console.error('[ExportAPI] Failed to get export formats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get export formats',
            details: error.message
        });
    }
});

// POST /api/reports/export/preview/:format - Preview export (returns metadata, not actual file)
router.post('/export/preview/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const { reportType, templateId, filters, options } = req.body;

        // Validate format
        if (!['pdf', 'excel'].includes(format)) {
            return res.status(400).json({
                error: 'Invalid export format. Supported formats: pdf, excel'
            });
        }

        // Validate required fields
        if (!reportType || !templateId) {
            return res.status(400).json({
                error: 'Missing required fields: reportType and templateId'
            });
        }

        console.log(`[ExportAPI] Generating preview for ${format} export`);

        // Generate a preview by getting report data (but not actually creating the file)
        const reportResult = await ReportRunner.generateReport(reportType, templateId, filters || {});

        // Calculate preview metadata
        const preview = {
            format,
            reportType,
            templateId,
            filename: `report_${reportType}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
            estimatedSize: format === 'pdf' ?
                Math.max(50000, (reportResult.components?.length || 0) * 2000 + (reportResult.threats?.length || 0) * 1500) :
                Math.max(30000, (reportResult.components?.length || 0) * 500 + (reportResult.threats?.length || 0) * 300),
            dataSummary: {
                components: reportResult.components?.length || 0,
                threats: reportResult.threats?.length || 0,
                vulnerabilities: reportResult.vulnerabilities?.length || 0,
                projects: reportResult.projects?.length || 0
            },
            generationTime: new Date().toISOString(),
            options: options || {}
        };

        res.json({
            success: true,
            data: preview
        });

    } catch (error) {
        console.error('[ExportAPI] Preview generation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Preview generation failed',
            details: error.message
        });
    }
});

// POST /api/reports/export/batch/:format - Export batch reports
router.post('/export/batch/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const { projectIds, reportType, templateId, filters, options } = req.body;

        // Validate format
        if (!['pdf', 'excel'].includes(format)) {
            return res.status(400).json({
                error: 'Invalid export format. Supported formats: pdf, excel'
            });
        }

        // Validate required fields
        if (!Array.isArray(projectIds) || projectIds.length === 0) {
            return res.status(400).json({
                error: 'Missing or invalid projectIds array'
            });
        }
        if (!reportType || !templateId) {
            return res.status(400).json({
                error: 'Missing required fields: reportType and templateId'
            });
        }

        console.log(`[ExportAPI] Starting batch ${format} export for ${projectIds.length} projects`);

        // For batch exports, we'll create a ZIP file containing all reports
        // This is a simplified implementation - in production you'd want to use a proper ZIP library

        const batchResults = [];
        const exportPromises = projectIds.map(async (projectId) => {
            try {
                const projectFilters = {
                    ...filters,
                    projectUuid: projectId,
                    project_id: projectId
                };

                const reportResult = await ReportRunner.generateReport(reportType, templateId, projectFilters);

                const exportData = {
                    metadata: {
                        reportType,
                        templateName: templateId,
                        generatedAt: new Date().toISOString(),
                        projectId,
                        projectName: reportResult.projects?.[0]?.name || null
                    },
                    statistics: {
                        totalComponents: reportResult.components?.length || 0,
                        totalThreats: reportResult.threats?.length || 0,
                        totalVulnerabilities: reportResult.vulnerabilities?.length || 0
                    },
                    projects: reportResult.projects || [],
                    components: reportResult.components || [],
                    threats: reportResult.threats || [],
                    vulnerabilities: reportResult.vulnerabilities || [],
                    safeguards: reportResult.safeguards || {}
                };

                let buffer;
                if (format === 'pdf') {
                    buffer = await reportExporter.exportToPDF(exportData, options);
                } else {
                    buffer = await reportExporter.exportToExcel(exportData, options);
                }

                batchResults.push({
                    projectId,
                    projectName: exportData.metadata.projectName,
                    success: true,
                    size: buffer.length,
                    filename: `report_${reportType}_${projectId}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
                });

                return buffer;

            } catch (error) {
                console.error(`[ExportAPI] Batch export failed for project ${projectId}:`, error);
                batchResults.push({
                    projectId,
                    success: false,
                    error: error.message
                });
                return null;
            }
        });

        // Note: In a real implementation, you'd collect all buffers and create a ZIP file
        // For this demo, we'll just return metadata about what would be exported
        await Promise.allSettled(exportPromises);

        const successfulExports = batchResults.filter(r => r.success);
        const failedExports = batchResults.filter(r => !r.success);

        res.json({
            success: true,
            data: {
                totalProjects: projectIds.length,
                successfulExports: successfulExports.length,
                failedExports: failedExports.length,
                results: batchResults,
                summary: {
                    format,
                    reportType,
                    templateId,
                    totalSize: successfulExports.reduce((sum, r) => sum + (r.size || 0), 0),
                    averageSize: successfulExports.length > 0 ?
                        Math.round(successfulExports.reduce((sum, r) => sum + (r.size || 0), 0) / successfulExports.length) : 0
                }
            }
        });

    } catch (error) {
        console.error('[ExportAPI] Batch export failed:', error);
        res.status(500).json({
            success: false,
            error: 'Batch export failed',
            details: error.message
        });
    }
});

module.exports = router;
