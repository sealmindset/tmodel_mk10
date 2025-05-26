// dashboard-charts.js
// Renders dashboard charts for Threat Models, Components, and Safeguards
// Requires Chart.js to be loaded on the page

document.addEventListener('DOMContentLoaded', function () {
  fetch('/api/dashboard-stats', { credentials: 'same-origin' })
    .then(response => response.json())
    .then(result => {
      if (!result.success || !result.data) {
        console.error('Failed to load dashboard stats:', result.error);
        return;
      }
      const { modelsByMonth, componentsByType, safeguardsByType } = result.data;

      // Threat Models by Environment (Bar Chart)
      if (document.getElementById('threatModelsByEnvChart')) {
        new Chart(document.getElementById('threatModelsByEnvChart').getContext('2d'), {
          type: 'bar',
          data: {
            labels: modelsByMonth.map(item => item.month || item.environment),
            datasets: [{
              label: 'Threat Models',
              data: modelsByMonth.map(item => item.count),
              backgroundColor: 'rgba(54, 162, 235, 0.7)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: 'Threat Models by Environment' }
            },
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
      }

      // Components by Type (Pie Chart)
      if (document.getElementById('componentsByTypeChart')) {
        new Chart(document.getElementById('componentsByTypeChart').getContext('2d'), {
          type: 'pie',
          data: {
            labels: componentsByType.map(item => item.type),
            datasets: [{
              label: 'Components',
              data: componentsByType.map(item => item.count),
              backgroundColor: [
                'rgba(255, 99, 132, 0.7)',
                'rgba(255, 206, 86, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(153, 102, 255, 0.7)',
                'rgba(255, 159, 64, 0.7)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              title: { display: true, text: 'Components by Type' }
            }
          }
        });
      }

      // Safeguards by Type (Doughnut Chart)
      if (document.getElementById('safeguardsByTypeChart')) {
        new Chart(document.getElementById('safeguardsByTypeChart').getContext('2d'), {
          type: 'doughnut',
          data: {
            labels: safeguardsByType.map(item => item.type),
            datasets: [{
              label: 'Safeguards',
              data: safeguardsByType.map(item => item.count),
              backgroundColor: [
                'rgba(54, 162, 235, 0.7)',
                'rgba(255, 99, 132, 0.7)',
                'rgba(255, 206, 86, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(153, 102, 255, 0.7)'
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              title: { display: true, text: 'Safeguards by Type' }
            }
          }
        });
      }
    })
    .catch(err => {
      console.error('Error fetching dashboard stats:', err);
    });
});
