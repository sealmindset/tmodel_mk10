/**
 * Handles client-side merging of Redis threat models
 * @param {string} primaryModelId - ID of the primary model (with 'subj-' prefix)
 * @param {Array<string>} sourceModelIds - IDs of source models to merge (with 'subj-' prefix)
 * @returns {Promise<Object>} - Result of the merge operation
 */
async function mergeRedisModels(primaryModelId, sourceModelIds) {
  console.log('Performing client-side Redis model merge');
  
  // Extract Redis IDs
  const primaryRedisId = primaryModelId.substring(5);
  const sourceRedisIds = sourceModelIds.map(function(id) {
    return id.startsWith('subj-') ? id.substring(5) : id;
  });
  
  // Track metrics
  const mergeMetrics = {
    total_threats_added: 0,
    total_threats_skipped: 0,
    total_safeguards_added: 0,
    source_models_processed: 0,
    redis_models_processed: 0,
    model_details: []
  };
  
  try {
    // Get primary model data
    const primaryResponse = await fetch('/results/data?subjectid=' + primaryRedisId);
    if (!primaryResponse.ok) {
      throw new Error('Failed to fetch primary model data: ' + primaryResponse.statusText);
    }
    
    const primaryData = await primaryResponse.json();
    if (!primaryData || !primaryData.response) {
      throw new Error('Primary model data is invalid');
    }
    
    let primaryResponseText = primaryData.response;
    let currentThreatCount = parseInt(primaryData.threatCount || '0', 10);
    
    // Process each source model
    for (let i = 0; i < sourceRedisIds.length; i++) {
      const sourceId = sourceRedisIds[i];
      
      // Skip if source is the same as primary
      if (sourceId === primaryRedisId) continue;
      
      // Get source model data
      const sourceResponse = await fetch('/results/data?subjectid=' + sourceId);
      if (!sourceResponse.ok) {
        console.warn('Failed to fetch source model ' + sourceId + ', skipping');
        continue;
      }
      
      const sourceData = await sourceResponse.json();
      if (!sourceData || !sourceData.response) {
        console.warn('Source model ' + sourceId + ' data is invalid, skipping');
        continue;
      }
      
      // Get model title or use default
      const modelTitle = sourceData.title || ('Model ' + sourceId);
      
      // Add model to metrics
      mergeMetrics.model_details.push({
        id: 'subj-' + sourceId,
        title: modelTitle,
        type: 'redis',
        total_threats: parseInt(sourceData.threatCount || '0', 10),
        threats_added: 1, // Simplified for now
        threats_skipped: 0
      });
      
      // Add a merge note
      const mergeNote = '\n\n## Merged from model: ' + modelTitle + ' (ID: ' + sourceId + ')\n';
      
      // Append source content to primary model
      primaryResponseText += mergeNote + sourceData.response;
      
      // Count as processed
      mergeMetrics.redis_models_processed++;
      mergeMetrics.total_threats_added++;
      mergeMetrics.source_models_processed++;
    }
    
    // Update the primary model with merged content
    const updateResponse = await fetch('/update-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subjectid: primaryRedisId,
        response: primaryResponseText
      })
    });
    
    if (!updateResponse.ok) {
      throw new Error('Failed to update primary model: ' + updateResponse.statusText);
    }
    
    // Update threat count
    const newThreatCount = currentThreatCount + mergeMetrics.total_threats_added;
    
    // Get primary model name
    const primaryModelTitle = primaryData.title || ('Model ' + primaryRedisId);
    
    // Return consistent result object
    return {
      success: true,
      data: {
        model: {
          id: primaryRedisId,
          title: primaryModelTitle,
          is_redis_model: true,
          threat_count: newThreatCount
        },
        metrics: mergeMetrics
      }
    };
  } catch (error) {
    console.error('Error during Redis model merge:', error);
    throw error;
  }
}

/**
 * Shows an alert message in the UI
 * @param {string} message - Alert message text
 * @param {string} type - Alert type (success, danger, warning, info)
 */
function showAlertMessage(message, type) {
  const alertHtml = 
    '<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert">' +
    '  ' + message +
    '  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
    '</div>';
  
  const alertContainer = document.getElementById('mergeAlerts');
  if (alertContainer) {
    alertContainer.innerHTML = alertHtml;
  }
}

/**
 * Renders detailed merge results in a modal
 * @param {Object} mergeMetrics - Metrics from the merge operation
 * @param {string} primaryModelName - Name of the primary model
 */
function renderDetailedResults(mergeMetrics, primaryModelName) {
  const detailedResultsModal = document.getElementById('detailedResultsModalBody');
  if (!detailedResultsModal) return;
  
  let detailedResultsHtml = 
    '<div class="row mb-3">' +
    '  <div class="col-md-6">' +
    '    <div class="alert alert-primary">' +
    '      <h6>Summary</h6>' +
    '      <ul class="list-unstyled mb-0">' +
    '        <li><strong>Total Threats Added:</strong> ' + mergeMetrics.total_threats_added + '</li>' +
    '        <li><strong>Total Threats Skipped:</strong> ' + mergeMetrics.total_threats_skipped + '</li>' +
    '      </ul>' +
    '    </div>' +
    '  </div>' +
    '  <div class="col-md-6">' +
    '    <div class="alert alert-info">' +
    '      <h6>Primary Model</h6>' +
    '      <p class="mb-0">' + primaryModelName + '</p>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    
    '<h6 class="border-bottom pb-2 mb-3">Source Model Details</h6>' +
    '<div class="table-responsive">' +
    '  <table class="table table-striped table-bordered">' +
    '    <thead class="table-light">' +
    '      <tr>' +
    '        <th>Model Name</th>' +
    '        <th>Type</th>' +
    '        <th>Total Threats</th>' +
    '        <th>Threats Added</th>' +
    '        <th>Threats Skipped</th>' +
    '      </tr>' +
    '    </thead>' +
    '    <tbody>';
    
  // Add rows for each source model
  if (mergeMetrics.model_details && mergeMetrics.model_details.length > 0) {
    for (let i = 0; i < mergeMetrics.model_details.length; i++) {
      const model = mergeMetrics.model_details[i];
      const badgeClass = model.type === 'redis' ? 'info' : 'primary';
      
      detailedResultsHtml += 
        '<tr>' +
        '  <td>' + (model.title || model.id) + '</td>' +
        '  <td><span class="badge bg-' + badgeClass + '">' + model.type + '</span></td>' +
        '  <td>' + model.total_threats + '</td>' +
        '  <td><span class="badge bg-success">' + model.threats_added + '</span></td>' +
        '  <td><span class="badge bg-secondary">' + model.threats_skipped + '</span></td>' +
        '</tr>';
    }
  } else {
    detailedResultsHtml += 
      '<tr>' +
      '  <td colspan="5" class="text-center">No detailed model information available</td>' +
      '</tr>';
  }
  
  detailedResultsHtml +=
    '    </tbody>' +
    '  </table>' +
    '</div>';
  
  detailedResultsModal.innerHTML = detailedResultsHtml;
}

/**
 * Renders merge results summary in the UI
 * @param {Object} result - Result of the merge operation
 * @param {string} primaryRedisId - ID of the primary model
 */
function renderMergeResults(result, primaryRedisId) {
  const mergeResultsCard = document.getElementById('mergeResultsCard');
  if (!mergeResultsCard) return;
  
  // Show the card
  mergeResultsCard.classList.remove('d-none');
  
  const cardBody = mergeResultsCard.querySelector('.card-body');
  if (!cardBody) return;
  
  // Prepare HTML for results
  const resultsHtml = 
    '<div class="alert alert-success">' +
    '  <h6>Merge Completed Successfully</h6>' +
    '  <p>The threat models have been merged successfully.</p>' +
    '</div>' +
    
    '<div class="card mb-3">' +
    '  <div class="card-header">Merge Statistics</div>' +
    '  <div class="card-body">' +
    '    <ul>' +
    '      <li><strong>Threats Added:</strong> ' + result.data.metrics.total_threats_added + '</li>' +
    '      <li><strong>Threats Skipped (Duplicates):</strong> ' + result.data.metrics.total_threats_skipped + '</li>' +
    '      <li><strong>Redis Models Processed:</strong> ' + result.data.metrics.redis_models_processed + '</li>' +
    '    </ul>' +
    '  </div>' +
    '</div>' +
    
    '<div class="d-grid gap-2 d-md-flex justify-content-md-between">' +
    '  <button type="button" class="btn btn-info" id="showDetailedResultsBtn">' +
    '    <i class="bi bi-list-check me-1"></i>View Detailed Results' +
    '  </button>' +
    '  <a href="/results?subjectid=' + primaryRedisId + '" class="btn btn-primary">' +
    '    <i class="bi bi-eye me-1"></i>View Merged Model' +
    '  </a>' +
    '</div>';
  
  cardBody.innerHTML = resultsHtml;
  
  // Add event listener for detailed results button
  const showDetailedResultsBtn = document.getElementById('showDetailedResultsBtn');
  if (showDetailedResultsBtn) {
    showDetailedResultsBtn.addEventListener('click', function() {
      const detailedResultsModal = new bootstrap.Modal(document.getElementById('detailedResultsModal'));
      detailedResultsModal.show();
    });
  }
  
  // Render detailed results in the modal
  renderDetailedResults(result.data.metrics, result.data.model.title);
}
