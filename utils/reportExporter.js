/**
 * Report Export Utilities
 *
 * Provides PDF and Excel export functionality for generated reports
 */

const puppeteer = require('puppeteer');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class ReportExporter {
    constructor(options = {}) {
        this.tempDir = options.tempDir || './temp';
        this.browser = null;
        this.initialized = false;
    }

    /**
     * Initialize the exporter (setup browser, ensure temp directory)
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Ensure temp directory exists
            await fs.mkdir(this.tempDir, { recursive: true });

            // Launch browser for PDF generation
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.initialized = true;
            console.log('[ReportExporter] Initialized successfully');

        } catch (error) {
            console.error('[ReportExporter] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Export report to PDF format
     * @param {Object} reportData - Report data and metadata
     * @param {Object} options - Export options
     * @returns {Promise<Buffer>} PDF buffer
     */
    async exportToPDF(reportData, options = {}) {
        await this.initialize();

        const {
            title = 'Report',
            includeMetadata = true,
            pageFormat = 'A4',
            orientation = 'portrait',
            includeCharts = false
        } = options;

        try {
            // Generate HTML content for the report
            const htmlContent = this.generatePDFHTML(reportData, {
                title,
                includeMetadata,
                includeCharts
            });

            // Create a new page
            const page = await this.browser.newPage();

            // Set content and wait for loading
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            // Generate PDF
            const pdfBuffer = await page.pdf({
                format: pageFormat,
                printBackground: true,
                orientation: orientation,
                margin: {
                    top: '1cm',
                    right: '1cm',
                    bottom: '1cm',
                    left: '1cm'
                },
                displayHeaderFooter: includeMetadata,
                headerTemplate: includeMetadata ? this.generatePDFHeader(title) : '',
                footerTemplate: includeMetadata ? this.generatePDFFooter() : ''
            });

            await page.close();

            console.log(`[ReportExporter] PDF generated successfully: ${title}`);
            return pdfBuffer;

        } catch (error) {
            console.error('[ReportExporter] PDF generation failed:', error);
            throw new Error(`PDF export failed: ${error.message}`);
        }
    }

    /**
     * Export report to Excel format
     * @param {Object} reportData - Report data and metadata
     * @param {Object} options - Export options
     * @returns {Promise<Buffer>} Excel buffer
     */
    async exportToExcel(reportData, options = {}) {
        const {
            title = 'Report',
            includeMetadata = true,
            includeCharts = false
        } = options;

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Threat Model Report Generator';
            workbook.created = new Date();

            // Add metadata sheet if requested
            if (includeMetadata) {
                this.addMetadataSheet(workbook, reportData, title);
            }

            // Add data sheets based on report type
            await this.addDataSheets(workbook, reportData);

            // Generate buffer
            const buffer = await workbook.xlsx.writeBuffer();

            console.log(`[ReportExporter] Excel generated successfully: ${title}`);
            return buffer;

        } catch (error) {
            console.error('[ReportExporter] Excel generation failed:', error);
            throw new Error(`Excel export failed: ${error.message}`);
        }
    }

    /**
     * Generate HTML content for PDF export
     * @param {Object} reportData - Report data
     * @param {Object} options - HTML generation options
     * @returns {string} HTML content
     */
    generatePDFHTML(reportData, options) {
        const { title, includeMetadata, includeCharts } = options;

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #007acc;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    color: #007acc;
                    margin: 0;
                    font-size: 28px;
                }
                .metadata {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 30px;
                    border-left: 4px solid #007acc;
                }
                .section {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }
                .section h2 {
                    color: #007acc;
                    border-bottom: 1px solid #e1e4e8;
                    padding-bottom: 10px;
                    margin-top: 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 12px;
                }
                th, td {
                    border: 1px solid #dee2e6;
                    padding: 8px 12px;
                    text-align: left;
                }
                th {
                    background-color: #f8f9fa;
                    font-weight: 600;
                    color: #495057;
                }
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .status-badge {
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                .status-high { background: #dc3545; color: white; }
                .status-medium { background: #ffc107; color: black; }
                .status-low { background: #28a745; color: white; }
                .status-info { background: #17a2b8; color: white; }
                .footer {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    font-size: 11px;
                    color: #6c757d;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${title}</h1>
            </div>

            ${includeMetadata ? this.generateMetadataHTML(reportData) : ''}

            <div class="content">
                ${this.generateContentHTML(reportData)}
            </div>

            <div class="footer">
                Generated by Threat Model Report Generator on ${new Date().toLocaleString()}
            </div>
        </body>
        </html>`;
    }

    /**
     * Generate metadata HTML section
     * @param {Object} reportData - Report data
     * @returns {string} HTML content
     */
    generateMetadataHTML(reportData) {
        const metadata = reportData.metadata || {};
        const statistics = reportData.statistics || {};

        return `
        <div class="metadata">
            <h3>Report Metadata</h3>
            <p><strong>Generated:</strong> ${new Date(metadata.generatedAt || Date.now()).toLocaleString()}</p>
            <p><strong>Report Type:</strong> ${metadata.reportType || 'Unknown'}</p>
            <p><strong>Template:</strong> ${metadata.templateName || 'Unknown'}</p>
            ${metadata.projectName ? `<p><strong>Project:</strong> ${metadata.projectName}</p>` : ''}
            ${statistics.totalComponents ? `<p><strong>Total Components:</strong> ${statistics.totalComponents}</p>` : ''}
            ${statistics.totalThreats ? `<p><strong>Total Threats:</strong> ${statistics.totalThreats}</p>` : ''}
            ${statistics.totalVulnerabilities ? `<p><strong>Total Vulnerabilities:</strong> ${statistics.totalVulnerabilities}</p>` : ''}
        </div>`;
    }

    /**
     * Generate content HTML sections
     * @param {Object} reportData - Report data
     * @returns {string} HTML content
     */
    generateContentHTML(reportData) {
        let html = '';

        // Projects section
        if (reportData.projects && Array.isArray(reportData.projects)) {
            html += this.generateProjectsHTML(reportData.projects);
        }

        // Components section
        if (reportData.components && Array.isArray(reportData.components)) {
            html += this.generateComponentsHTML(reportData.components);
        }

        // Threats section
        if (reportData.threats && Array.isArray(reportData.threats)) {
            html += this.generateThreatsHTML(reportData.threats);
        }

        // Vulnerabilities section
        if (reportData.vulnerabilities && Array.isArray(reportData.vulnerabilities)) {
            html += this.generateVulnerabilitiesHTML(reportData.vulnerabilities);
        }

        // Safeguards section
        if (reportData.safeguards && typeof reportData.safeguards === 'object') {
            html += this.generateSafeguardsHTML(reportData.safeguards);
        }

        return html;
    }

    /**
     * Generate projects HTML section
     * @param {Array} projects - Projects data
     * @returns {string} HTML content
     */
    generateProjectsHTML(projects) {
        if (projects.length === 0) return '';

        return `
        <div class="section">
            <h2>Projects</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Business Unit</th>
                        <th>Criticality</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${projects.map(project => `
                        <tr>
                            <td>${project.name || ''}</td>
                            <td>${project.description || ''}</td>
                            <td>${project.status || ''}</td>
                            <td>${project.business_unit || ''}</td>
                            <td>${project.criticality || ''}</td>
                            <td>${project.updated_at ? new Date(project.updated_at).toLocaleDateString() : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }

    /**
     * Generate components HTML section
     * @param {Array} components - Components data
     * @returns {string} HTML content
     */
    generateComponentsHTML(components) {
        if (components.length === 0) return '';

        return `
        <div class="section">
            <h2>Components</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Version</th>
                        <th>Hostname</th>
                        <th>IP Address</th>
                    </tr>
                </thead>
                <tbody>
                    ${components.map(component => `
                        <tr>
                            <td>${component.name || ''}</td>
                            <td>${component.type || ''}</td>
                            <td>${component.description || ''}</td>
                            <td>${component.version || ''}</td>
                            <td>${component.hostname || ''}</td>
                            <td>${component.ip_address || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }

    /**
     * Generate threats HTML section
     * @param {Array} threats - Threats data
     * @returns {string} HTML content
     */
    generateThreatsHTML(threats) {
        if (threats.length === 0) return '';

        return `
        <div class="section">
            <h2>Threats</h2>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Severity</th>
                        <th>Status</th>
                        <th>STRIDE Category</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${threats.map(threat => `
                        <tr>
                            <td>${threat.title || ''}</td>
                            <td>${threat.description || ''}</td>
                            <td>
                                <span class="status-badge status-${(threat.severity || '').toLowerCase()}">
                                    ${threat.severity || ''}
                                </span>
                            </td>
                            <td>${threat.status || ''}</td>
                            <td>${threat.stride_category || ''}</td>
                            <td>${threat.created_at ? new Date(threat.created_at).toLocaleDateString() : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }

    /**
     * Generate vulnerabilities HTML section
     * @param {Array} vulnerabilities - Vulnerabilities data
     * @returns {string} HTML content
     */
    generateVulnerabilitiesHTML(vulnerabilities) {
        if (vulnerabilities.length === 0) return '';

        return `
        <div class="section">
            <h2>Vulnerabilities</h2>
            <table>
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Severity</th>
                        <th>CVE</th>
                        <th>Component</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${vulnerabilities.map(vuln => `
                        <tr>
                            <td>${vuln.title || ''}</td>
                            <td>${vuln.description || ''}</td>
                            <td>
                                <span class="status-badge status-${(vuln.severity || '').toLowerCase()}">
                                    ${vuln.severity || ''}
                                </span>
                            </td>
                            <td>${vuln.cve || ''}</td>
                            <td>${vuln.component_name || ''}</td>
                            <td>${vuln.status || ''}</td>
                            <td>${vuln.created_at ? new Date(vuln.created_at).toLocaleDateString() : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }

    /**
     * Generate safeguards HTML section
     * @param {Object} safeguards - Safeguards data
     * @returns {string} HTML content
     */
    generateSafeguardsHTML(safeguards) {
        const safeguardList = Object.values(safeguards || {});
        if (safeguardList.length === 0) return '';

        return `
        <div class="section">
            <h2>Safeguards</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Implementation Status</th>
                        <th>Effectiveness</th>
                    </tr>
                </thead>
                <tbody>
                    ${safeguardList.map(safeguard => `
                        <tr>
                            <td>${safeguard.name || ''}</td>
                            <td>${safeguard.type || ''}</td>
                            <td>${safeguard.description || ''}</td>
                            <td>${safeguard.implementation_status || ''}</td>
                            <td>${safeguard.effectiveness || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }

    /**
     * Generate PDF header template
     * @param {string} title - Report title
     * @returns {string} Header HTML template
     */
    generatePDFHeader(title) {
        return `
        <div style="font-size: 10px; text-align: center; width: 100%; padding: 5px;">
            ${title} - Generated on ${new Date().toLocaleDateString()}
        </div>`;
    }

    /**
     * Generate PDF footer template
     * @returns {string} Footer HTML template
     */
    generatePDFFooter() {
        return `
        <div style="font-size: 10px; text-align: center; width: 100%; padding: 5px;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`;
    }

    /**
     * Add metadata sheet to Excel workbook
     * @param {ExcelJS.Workbook} workbook - Excel workbook
     * @param {Object} reportData - Report data
     * @param {string} title - Report title
     */
    addMetadataSheet(workbook, reportData, title) {
        const sheet = workbook.addWorksheet('Metadata');

        // Add metadata
        sheet.addRow(['Report Title', title]);
        sheet.addRow(['Generated', new Date().toLocaleString()]);
        sheet.addRow(['Report Type', reportData.metadata?.reportType || 'Unknown']);
        sheet.addRow(['Template', reportData.metadata?.templateName || 'Unknown']);

        if (reportData.metadata?.projectName) {
            sheet.addRow(['Project', reportData.metadata.projectName]);
        }

        sheet.addRow([]); // Empty row

        // Add statistics
        if (reportData.statistics) {
            sheet.addRow(['Statistics']);
            Object.entries(reportData.statistics).forEach(([key, value]) => {
                if (typeof value === 'number') {
                    sheet.addRow([key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value]);
                }
            });
        }

        // Style the sheet
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 30;
    }

    /**
     * Add data sheets to Excel workbook
     * @param {ExcelJS.Workbook} workbook - Excel workbook
     * @param {Object} reportData - Report data
     */
    async addDataSheets(workbook, reportData) {
        // Projects sheet
        if (reportData.projects && Array.isArray(reportData.projects)) {
            this.addProjectsSheet(workbook, reportData.projects);
        }

        // Components sheet
        if (reportData.components && Array.isArray(reportData.components)) {
            this.addComponentsSheet(workbook, reportData.components);
        }

        // Threats sheet
        if (reportData.threats && Array.isArray(reportData.threats)) {
            this.addThreatsSheet(workbook, reportData.threats);
        }

        // Vulnerabilities sheet
        if (reportData.vulnerabilities && Array.isArray(reportData.vulnerabilities)) {
            this.addVulnerabilitiesSheet(workbook, reportData.vulnerabilities);
        }
    }

    /**
     * Add projects sheet to Excel workbook
     * @param {ExcelJS.Workbook} workbook - Excel workbook
     * @param {Array} projects - Projects data
     */
    addProjectsSheet(workbook, projects) {
        const sheet = workbook.addWorksheet('Projects');

        // Add headers
        sheet.addRow(['Name', 'Description', 'Status', 'Business Unit', 'Criticality', 'Data Classification', 'Created', 'Updated']);

        // Add data
        projects.forEach(project => {
            sheet.addRow([
                project.name || '',
                project.description || '',
                project.status || '',
                project.business_unit || '',
                project.criticality || '',
                project.data_classification || '',
                project.created_at ? new Date(project.created_at).toLocaleDateString() : '',
                project.updated_at ? new Date(project.updated_at).toLocaleDateString() : ''
            ]);
        });

        // Style the sheet
        this.styleExcelSheet(sheet, ['Name', 'Description']);
    }

    /**
     * Add components sheet to Excel workbook
     * @param {ExcelJS.Workbook} workbook - Excel workbook
     * @param {Array} components - Components data
     */
    addComponentsSheet(workbook, components) {
        const sheet = workbook.addWorksheet('Components');

        // Add headers
        sheet.addRow(['Name', 'Type', 'Description', 'Version', 'Hostname', 'IP Address', 'Is Reusable', 'Tags']);

        // Add data
        components.forEach(component => {
            sheet.addRow([
                component.name || '',
                component.type || '',
                component.description || '',
                component.version || '',
                component.hostname || '',
                component.ip_address || '',
                component.is_reusable ? 'Yes' : 'No',
                Array.isArray(component.tags) ? component.tags.join(', ') : ''
            ]);
        });

        // Style the sheet
        this.styleExcelSheet(sheet, ['Name', 'Description']);
    }

    /**
     * Add threats sheet to Excel workbook
     * @param {ExcelJS.Workbook} workbook - Excel workbook
     * @param {Array} threats - Threats data
     */
    addThreatsSheet(workbook, threats) {
        const sheet = workbook.addWorksheet('Threats');

        // Add headers
        sheet.addRow(['Title', 'Description', 'Severity', 'Status', 'STRIDE Category', 'Impact', 'Likelihood', 'Risk Score', 'Created']);

        // Add data
        threats.forEach(threat => {
            sheet.addRow([
                threat.title || '',
                threat.description || '',
                threat.severity || '',
                threat.status || '',
                threat.stride_category || '',
                threat.impact || '',
                threat.likelihood || '',
                threat.risk_score || '',
                threat.created_at ? new Date(threat.created_at).toLocaleDateString() : ''
            ]);
        });

        // Style the sheet
        this.styleExcelSheet(sheet, ['Title', 'Description']);

        // Add conditional formatting for severity
        const severityColumn = sheet.getColumn(3);
        sheet.addConditionalFormatting({
            ref: severityColumn.letter + '2:' + severityColumn.letter + (threats.length + 1),
            rules: [
                { type: 'containsText', operator: 'containsText', text: 'Critical', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9534F' } } } },
                { type: 'containsText', operator: 'containsText', text: 'High', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC107' } } } },
                { type: 'containsText', operator: 'containsText', text: 'Medium', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9800' } } } },
                { type: 'containsText', operator: 'containsText', text: 'Low', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } } } }
            ]
        });
    }

    /**
     * Add vulnerabilities sheet to Excel workbook
     * @param {ExcelJS.Workbook} workbook - Excel workbook
     * @param {Array} vulnerabilities - Vulnerabilities data
     */
    addVulnerabilitiesSheet(workbook, vulnerabilities) {
        const sheet = workbook.addWorksheet('Vulnerabilities');

        // Add headers
        sheet.addRow(['Title', 'Description', 'Severity', 'CVE', 'Component', 'Status', 'CVSS Score', 'Exploitability', 'Created']);

        // Add data
        vulnerabilities.forEach(vuln => {
            sheet.addRow([
                vuln.title || '',
                vuln.description || '',
                vuln.severity || '',
                vuln.cve || '',
                vuln.component_name || '',
                vuln.status || '',
                vuln.cvss_score || '',
                vuln.exploitability || '',
                vuln.created_at ? new Date(vuln.created_at).toLocaleDateString() : ''
            ]);
        });

        // Style the sheet
        this.styleExcelSheet(sheet, ['Title', 'Description']);

        // Add conditional formatting for severity
        const severityColumn = sheet.getColumn(3);
        sheet.addConditionalFormatting({
            ref: severityColumn.letter + '2:' + severityColumn.letter + (vulnerabilities.length + 1),
            rules: [
                { type: 'containsText', operator: 'containsText', text: 'Critical', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9534F' } } } },
                { type: 'containsText', operator: 'containsText', text: 'High', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC107' } } },
                { type: 'containsText', operator: 'containsText', text: 'Medium', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF9800' } } },
                { type: 'containsText', operator: 'containsText', text: 'Low', style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } } }
            ]
        });
    }

    /**
     * Apply consistent styling to Excel sheet
     * @param {ExcelJS.Worksheet} sheet - Excel worksheet
     * @param {Array} wideColumns - Columns that should be wider
     */
    styleExcelSheet(sheet, wideColumns = []) {
        // Set column widths
        sheet.columns.forEach((column, index) => {
            const header = sheet.getRow(1).getCell(index + 1).value;
            if (wideColumns.includes(header)) {
                column.width = 40;
            } else {
                column.width = 15;
            }
        });

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
        };
        headerRow.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // Add borders to all cells
        sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
    }

    /**
     * Save buffer to temporary file (for debugging)
     * @param {Buffer} buffer - File buffer
     * @param {string} filename - Filename
     * @returns {Promise<string>} File path
     */
    async saveToTempFile(buffer, filename) {
        const filepath = path.join(this.tempDir, filename);
        await fs.writeFile(filepath, buffer);
        console.log(`[ReportExporter] Saved to temp file: ${filepath}`);
        return filepath;
    }

    /**
     * Clean up temporary files
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            const files = await fs.readdir(this.tempDir);
            const deletePromises = files
                .filter(file => file.startsWith('export_'))
                .map(file => fs.unlink(path.join(this.tempDir, file)));

            await Promise.all(deletePromises);
            console.log(`[ReportExporter] Cleaned up ${deletePromises.length} temp files`);
        } catch (error) {
            console.warn('[ReportExporter] Cleanup failed:', error);
        }
    }

    /**
     * Gracefully close the exporter
     * @returns {Promise<void>}
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.initialized = false;
        console.log('[ReportExporter] Closed successfully');
    }
}

// Create singleton exporter instance
let reportExporter = null;

function getReportExporter(options = {}) {
    if (!reportExporter) {
        reportExporter = new ReportExporter(options);
    }
    return reportExporter;
}

module.exports = {
    ReportExporter,
    getReportExporter
};
