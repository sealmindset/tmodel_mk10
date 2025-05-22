/**
 * Threat Modeling UI Components
 * Provides visualization and interaction for threat models, threats, and safeguards
 */

document.addEventListener('DOMContentLoaded', function() {
  initThreatModelingComponents();
  setupEventListeners();
});

/**
 * Initialize threat modeling components
 */
function initThreatModelingComponents() {
  // Initialize risk matrix if present
  const riskMatrixElement = document.getElementById('riskMatrix');
  if (riskMatrixElement) {
    initializeRiskMatrix();
  }
  
  // Initialize risk metrics chart if present
  const riskMetricsElement = document.getElementById('riskMetricsChart');
  if (riskMetricsElement) {
    initializeRiskMetricsChart();
  }
  
  // Initialize safeguard effectiveness chart if present
  const safeguardChartElement = document.getElementById('safeguardEffectivenessChart');
  if (safeguardChartElement) {
    initializeSafeguardChart();
  }
  
  // Initialize vulnerability trends chart if present
  const vulnTrendsElement = document.getElementById('vulnerabilityTrendsChart');
  if (vulnTrendsElement) {
    initializeVulnerabilityTrendsChart();
  }
}

/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
  // Project selector
  const projectSelector = document.getElementById('projectSelector');
  if (projectSelector) {
    projectSelector.addEventListener('change', function() {
      loadProjectData(this.value);
    });
  }
  
  // Threat model version selector
  const versionSelector = document.getElementById('modelVersionSelector');
  if (versionSelector) {
    versionSelector.addEventListener('change', function() {
      loadThreatModelVersion(this.value);
    });
  }
  
  // New threat button
  const newThreatBtn = document.getElementById('newThreatBtn');
  if (newThreatBtn) {
    newThreatBtn.addEventListener('click', function() {
      showThreatForm();
    });
  }
  
  // New safeguard button
  const newSafeguardBtn = document.getElementById('newSafeguardBtn');
  if (newSafeguardBtn) {
    newSafeguardBtn.addEventListener('click', function() {
      showSafeguardForm();
    });
  }
  
  // Scan for vulnerabilities button
  const scanBtn = document.getElementById('scanVulnerabilitiesBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', function() {
      triggerVulnerabilityScan();
    });
  }
  
  // Setup form submission events
  setupFormSubmitHandlers();
}

/**
 * Initialize risk matrix visualization
 */
function initializeRiskMatrix() {
  const modelId = document.getElementById('currentModelId')?.value;
  if (!modelId) return;
  
  fetch(`/api/threats/metrics/matrix?threat_model_id=${modelId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        renderRiskMatrix(data.data);
      } else {
        showError('Failed to load risk matrix data');
      }
    })
    .catch(error => {
      console.error('Error loading risk matrix:', error);
      showError('Error loading risk matrix');
    });
}

/**
 * Render the risk matrix visualization
 */
function renderRiskMatrix(matrixData) {
  const container = document.getElementById('riskMatrix');
  if (!container) return;
  
  // Clear previous content
  container.innerHTML = '';
  
  // Create matrix table
  const table = document.createElement('table');
  table.className = 'risk-matrix-table';
  
  // Add header row for impact
  const headerRow = document.createElement('tr');
  
  // Empty corner cell
  const cornerCell = document.createElement('th');
  cornerCell.textContent = 'Likelihood / Impact';
  headerRow.appendChild(cornerCell);
  
  // Impact headers
  matrixData.impact.forEach(impact => {
    const th = document.createElement('th');
    th.textContent = impact;
    th.className = `impact-${impact.toLowerCase()}`;
    headerRow.appendChild(th);
  });
  
  table.appendChild(headerRow);
  
  // Add data rows
  matrixData.likelihood.forEach(likelihood => {
    const row = document.createElement('tr');
    
    // Likelihood cell
    const likelihoodCell = document.createElement('th');
    likelihoodCell.textContent = likelihood;
    likelihoodCell.className = `likelihood-${likelihood.toLowerCase()}`;
    row.appendChild(likelihoodCell);
    
    // Data cells
    matrixData.impact.forEach(impact => {
      const cell = document.createElement('td');
      const count = matrixData.data[likelihood][impact] || 0;
      
      // Set cell class based on risk level
      let riskLevel = 'low';
      if ((likelihood === 'High' && impact !== 'Low') || 
          (impact === 'High' && likelihood !== 'Low')) {
        riskLevel = 'high';
      } else if (likelihood !== 'Low' || impact !== 'Low') {
        riskLevel = 'medium';
      }
      
      cell.className = `risk-${riskLevel}`;
      
      // Cell content
      cell.textContent = count;
      
      // Add click handler to show threats in this category
      cell.addEventListener('click', function() {
        if (count > 0) {
          showThreatsInMatrix(likelihood, impact);
        }
      });
      
      row.appendChild(cell);
    });
    
    table.appendChild(row);
  });
  
  container.appendChild(table);
}

/**
 * Show threats for a specific likelihood and impact combination
 */
function showThreatsInMatrix(likelihood, impact) {
  const modelId = document.getElementById('currentModelId')?.value;
  if (!modelId) return;
  
  // Load threats matching the likelihood and impact
  fetch(`/api/threats?threat_model_id=${modelId}&likelihood=${likelihood}&impact=${impact}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showThreatListModal(data.data, `${likelihood} Likelihood / ${impact} Impact Threats`);
      } else {
        showError('Failed to load threats');
      }
    })
    .catch(error => {
      console.error('Error loading threats:', error);
      showError('Error loading threats');
    });
}

/**
 * Initialize risk metrics chart
 */
function initializeRiskMetricsChart() {
  const modelId = document.getElementById('currentModelId')?.value;
  if (!modelId) return;
  
  fetch(`/api/threats/metrics/risk?threat_model_id=${modelId}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        renderRiskMetricsChart(data.data);
      } else {
        showError('Failed to load risk metrics data');
      }
    })
    .catch(error => {
      console.error('Error loading risk metrics:', error);
      showError('Error loading risk metrics');
    });
}

/**
 * Render the risk metrics chart
 */
function renderRiskMetricsChart(metricsData) {
  const ctx = document.getElementById('riskMetricsChart');
  if (!ctx) return;
  
  // Process category data
  const categories = metricsData.byCategory.map(item => item.category);
  const counts = metricsData.byCategory.map(item => item.count);
  const avgRisks = metricsData.byCategory.map(item => item.avg_risk);
  
  // Create chart
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [
        {
          label: 'Threat Count',
          data: counts,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: 'Avg Risk Score',
          data: avgRisks,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          pointRadius: 4,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Threat Count'
          }
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          title: {
            display: true,
            text: 'Risk Score'
          },
          min: 0,
          max: 100
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Threats by Category and Risk Score'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
}

/**
 * Initialize safeguard effectiveness chart
 */
function initializeSafeguardChart() {
  fetch('/api/safeguards/stats/effectiveness')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        renderSafeguardChart(data.data);
      } else {
        showError('Failed to load safeguard data');
      }
    })
    .catch(error => {
      console.error('Error loading safeguard data:', error);
      showError('Error loading safeguard data');
    });
}

/**
 * Render safeguard effectiveness chart
 */
function renderSafeguardChart(safeguardData) {
  const ctx = document.getElementById('safeguardEffectivenessChart');
  if (!ctx) return;
  
  // Process data
  const labels = Object.keys(safeguardData);
  const avgEffectiveness = labels.map(key => safeguardData[key].avg_effectiveness);
  const counts = labels.map(key => safeguardData[key].count);
  
  // Create chart
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Effectiveness Score',
        data: avgEffectiveness,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Safeguard Effectiveness by Type'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.raw || 0;
              const count = counts[context.dataIndex] || 0;
              return `${label}: ${value}% (${count} safeguards)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Show error message
 */
function showError(message) {
  const errorContainer = document.getElementById('alertContainer');
  if (!errorContainer) return;
  
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-danger alert-dismissible fade show';
  alertDiv.setAttribute('role', 'alert');
  
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  errorContainer.appendChild(alertDiv);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const alert = new bootstrap.Alert(alertDiv);
    alert.close();
  }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;
  
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert alert-success alert-dismissible fade show';
  alertDiv.setAttribute('role', 'alert');
  
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alertDiv);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const alert = new bootstrap.Alert(alertDiv);
    alert.close();
  }, 5000);
}
