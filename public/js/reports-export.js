/**
 * Report Export Functions
 * Handles exporting reports in various formats (PDF, Markdown, print)
 */

// Export a report as a PDF
async function exportReportAsPDF(reportId) {
  try {
    // Fetch the report data
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const reports = await response.json();
    if (reports.length === 0) {
      throw new Error(`Report with ID ${reportId} not found`);
    }
    
    const report = reports[0];
    
    // Create a temporary element to render the PDF content
    const pdfContent = document.createElement('div');
    pdfContent.style.display = 'none';
    document.body.appendChild(pdfContent);
    
    // Add report title and metadata
    pdfContent.innerHTML = `
      <div class="pdf-container" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333;">${report.title || 'Untitled Report'}</h1>
          <p>Generated on ${new Date(report.created_at).toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p><strong>Last Updated:</strong> ${new Date(report.updated_at).toLocaleString()}</p>
          ${report.project_id ? `<p><strong>Project ID:</strong> ${report.project_id}</p>` : ''}
        </div>
        
        <div class="report-content">
    `;
    
    // Add report content sections
    if (report.content && report.content.sections) {
      report.content.sections.forEach(section => {
        pdfContent.innerHTML += `
          <div style="margin-bottom: 20px;">
            <h2 style="color: #2c5282; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${section.title}</h2>
            <div>${marked.parse(section.content)}</div>
          </div>
        `;
      });
    } else {
      pdfContent.innerHTML += '<div>This report has no content sections.</div>';
    }
    
    // Close the container
    pdfContent.innerHTML += '</div></div>';
    
    // Use html2pdf library if available
    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${report.title || 'report'}_${reportId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(pdfContent).save().then(() => {
        // Clean up
        document.body.removeChild(pdfContent);
      });
    } else {
      // Fallback: alert the user that we need html2pdf
      alert('PDF export requires html2pdf library. Please include it in your project.');
      document.body.removeChild(pdfContent);
      
      // Load html2pdf dynamically
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      document.head.appendChild(script);
      script.onload = () => {
        alert('html2pdf library has been loaded. Please try exporting again.');
      };
    }
  } catch (error) {
    console.error('Error exporting report as PDF:', error);
    alert(`Error exporting report: ${error.message}`);
  }
}

// Export a report as Markdown
async function exportReportAsMarkdown(reportId) {
  try {
    // Fetch the report data
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const reports = await response.json();
    if (reports.length === 0) {
      throw new Error(`Report with ID ${reportId} not found`);
    }
    
    const report = reports[0];
    
    // Build the markdown content
    let markdown = `# ${report.title || 'Untitled Report'}\n\n`;
    markdown += `Generated on ${new Date(report.created_at).toLocaleDateString()}\n\n`;
    markdown += `Last Updated: ${new Date(report.updated_at).toLocaleDateString()}\n\n`;
    
    if (report.project_id) {
      markdown += `Project ID: ${report.project_id}\n\n`;
    }
    
    markdown += `---\n\n`;
    
    // Add report sections
    if (report.content && report.content.sections) {
      report.content.sections.forEach(section => {
        markdown += `## ${section.title}\n\n${section.content}\n\n`;
      });
    } else {
      markdown += 'This report has no content sections.\n\n';
    }
    
    // Create a download link for the markdown file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${report.title || 'report'}_${reportId}.md`;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error('Error exporting report as Markdown:', error);
    alert(`Error exporting report: ${error.message}`);
  }
}

// Print a report
async function printReport(reportId) {
  try {
    // Fetch the report data
    const response = await fetch(`http://localhost:3010/report?id=eq.${reportId}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const reports = await response.json();
    if (reports.length === 0) {
      throw new Error(`Report with ID ${reportId} not found`);
    }
    
    const report = reports[0];
    
    // Create a temporary element for printing
    const printContent = document.createElement('div');
    printContent.style.display = 'none';
    document.body.appendChild(printContent);
    
    // Style for print
    printContent.innerHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1>${report.title || 'Untitled Report'}</h1>
          <p>Generated on ${new Date(report.created_at).toLocaleDateString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p><strong>Last Updated:</strong> ${new Date(report.updated_at).toLocaleString()}</p>
          ${report.project_id ? `<p><strong>Project ID:</strong> ${report.project_id}</p>` : ''}
        </div>
    `;
    
    // Add report content sections
    if (report.content && report.content.sections) {
      report.content.sections.forEach(section => {
        printContent.innerHTML += `
          <div style="margin-bottom: 20px; page-break-inside: avoid;">
            <h2 style="color: #2c5282; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">${section.title}</h2>
            <div>${marked.parse(section.content)}</div>
          </div>
        `;
      });
    } else {
      printContent.innerHTML += '<div>This report has no content sections.</div>';
    }
    
    // Close container
    printContent.innerHTML += '</div>';
    
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print: ${report.title || 'Report'}</title>
        <style>
          body { font-family: Arial, sans-serif; }
          h1 { color: #333; }
          h2 { color: #2c5282; break-after: avoid; }
          p { margin-bottom: 10px; }
          @media print {
            a { text-decoration: none; color: #000; }
            .no-print { display: none; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print();" style="padding: 10px 20px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer;">Print Report</button>
          <button onclick="window.close();" style="padding: 10px 20px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    // Clean up
    document.body.removeChild(printContent);
    
  } catch (error) {
    console.error('Error printing report:', error);
    alert(`Error printing report: ${error.message}`);
  }
}
