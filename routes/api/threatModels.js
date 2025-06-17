const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const threatModelService = require('../../services/threatModelService');
const ollamaUtil = require('../../utils/ollama');
const { ensureAuthenticated } = require('../../middleware/auth');
const resultsService = require('../../services/resultsService');

// Generate more content for a threat model
router.post('/:id/generate-more', ensureAuthenticated, async (req, res) => {
  const requestId = uuidv4();
  const moduleLoadId = `module-${Date.now()}`;
  
  // Log request details
  console.log(`[${requestId}] Request params:`, req.params);
  console.log(`[${requestId}] Request body:`, req.body);
  
  console.log(`[${requestId}] Starting generate-more endpoint`);
  
  try {
    // Ensure Ollama utility is initialized
    console.log(`[${requestId}] Ensuring Ollama utility is initialized...`);
    await ollamaUtil.init();
    console.log(`[${requestId}] Ollama utility initialized successfully`);
    
    // Validate required parameters
    if (!req.body.prompt) {
      console.error(`[${requestId}] Error: No prompt provided`);
      return res.status(400).json({ success: false, error: 'Prompt is required for generation.' });
    }
    
    const modelId = req.params.id;
    const { prompt, model: modelName } = req.body;
    let useModel = modelName;
    
    // Determine which model to use
    if (!useModel) {
      console.log(`[${requestId}] No model specified in request, checking threat model ${modelId}`);
      try {
        const threatModel = await threatModelService.getThreatModel(modelId);
        if (threatModel && threatModel.model) {
          useModel = threatModel.model;
          console.log(`[${requestId}] Using model from threat model: ${useModel}`);
        } else {
          useModel = ollamaUtil.getDefaultModel ? ollamaUtil.getDefaultModel() : 'llama3:latest';
          console.log(`[${requestId}] Using default model: ${useModel}`);
        }
      } catch (dbError) {
        console.error(`[${requestId}] Error fetching threat model:`, dbError);
        console.log(`[${requestId}] Falling back to default model`);
        useModel = 'llama3:latest';
      }
    } else {
      console.log(`[${requestId}] Using model from request: ${useModel}`);
    }
    
    // Log the model and prompt being used
    console.log(`[${requestId}] Generating completion with model: ${useModel}`);
    console.log(`[${requestId}] Prompt: ${prompt.substring(0, 100)}...`);
    
    // Get completion from Ollama
    const completion = await ollamaUtil.getCompletion(prompt, useModel);
    
    if (!completion || !completion.response) {
      throw new Error('Invalid response from Ollama API');
    }
    
    console.log(`[${requestId}] Successfully received completion`);
    
    // Return the completion
    return res.json({ 
      success: true, 
      completion: completion.response,
      model: useModel,
      requestId
    });
    
  } catch (error) {
    console.error(`[${requestId}] Error in generate-more:`, error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate content',
      details: error.message,
      requestId
    });
  }
});

// Route to merge selected threats between two models
router.post('/merge-selected', ensureAuthenticated, async (req, res) => {
  const requestId = uuidv4();
  console.log(`[${requestId}] Starting merge-selected endpoint`);
  
  try {
    const { targetId, sourceId, selectedThreats, direction } = req.body;
    
    if (!targetId || !sourceId || !selectedThreats || !Array.isArray(selectedThreats)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters (targetId, sourceId, selectedThreats)'
      });
    }
    
    console.log(`[${requestId}] Merging selected threats from ${sourceId} to ${targetId}`);
    console.log(`[${requestId}] Direction: ${direction}, Selected threats indices: ${selectedThreats.join(', ')}`);
    
    // Check if we're working with Redis models or PostgreSQL models
    const isRedisSourceModel = sourceId.startsWith('subj-');
    const isRedisTargetModel = targetId.startsWith('subj-');
    
    let sourceThreats = [];
    let targetResult;
    let mergedThreats = [];
    let skippedThreats = [];
    
    // Get source model threats
    if (isRedisSourceModel) {
      // Get Redis model source threats
      const sourceResult = await resultsService.getResultById(sourceId);
      if (!sourceResult) {
        throw new Error('Source model not found');
      }
      
      // Extract threats from content if it's Redis model
      sourceThreats = extractThreatsFromRedisContent(sourceResult.content || '', selectedThreats);
    } else {
      // Get PostgreSQL model source threats
      const sourceModel = await threatModelService.getThreatModel(sourceId);
      if (!sourceModel) {
        throw new Error('Source model not found');
      }
      
      // Filter to only selected threats
      sourceThreats = (sourceModel.threats || []).filter((threat, index) => selectedThreats.includes(index));
    }
    
    // Get target model to merge into
    if (isRedisTargetModel) {
      // Get Redis model target
      targetResult = await resultsService.getResultById(targetId);
      if (!targetResult) {
        throw new Error('Target model not found');
      }
      
      // Merge the selected threats
      const { mergedContent, addedCount, skippedCount } = await mergeThreatsIntoRedisModel(
        targetResult.content || '',
        sourceThreats
      );
      
      // Update the Redis model with merged content
      const updateResult = await resultsService.updateResultContent(targetId, mergedContent);
      
      // Return success response
      return res.json({
        success: true,
        data: {
          model: {
            id: targetId,
            is_redis_model: true
          },
          metrics: {
            total_threats_added: addedCount,
            total_threats_skipped: skippedCount,
            source_models_processed: 1
          }
        }
      });
    } else {
      // Handle PostgreSQL model target
      const targetModel = await threatModelService.getThreatModel(targetId);
      if (!targetModel) {
        throw new Error('Target model not found');
      }
      
      // Merge the selected threats into the target model
      const { addedThreats, skippedThreats } = await threatModelService.mergeSelectedThreats(
        targetId, 
        sourceThreats
      );
      
      // Return success response
      return res.json({
        success: true,
        data: {
          model: {
            id: targetId,
            title: targetModel.title,
            is_redis_model: false,
            threat_count: (targetModel.threats?.length || 0) + addedThreats.length
          },
          metrics: {
            total_threats_added: addedThreats.length,
            total_threats_skipped: skippedThreats.length,
            source_models_processed: 1
          }
        }
      });
    }
    
  } catch (error) {
    console.error(`[${requestId}] Error in merge-selected endpoint:`, error);
    return res.status(500).json({
      success: false,
      error: `Error merging threats: ${error.message}`
    });
  }
});

// Helper function to extract specific threats from Redis model content
function extractThreatsFromRedisContent(content, selectedIndices) {
  const threats = [];
  // Simple regex to find threat sections in markdown
  const threatRegex = /## Threat: ([^#]+)##\s*\*\*Description:\*\*\s*([^#]+)/g;
  let match;
  let index = 0;
  
  while ((match = threatRegex.exec(content)) !== null) {
    if (selectedIndices.includes(index)) {
      threats.push({
        title: match[1].trim(),
        description: match[2].trim(),
        content: match[0]
      });
    }
    index++;
  }
  
  return threats;
}

// Helper function to merge threats into Redis model content
async function mergeThreatsIntoRedisModel(targetContent, sourceThreats) {
  let mergedContent = targetContent;
  let addedCount = 0;
  let skippedCount = 0;
  
  // Check for duplicates based on title similarity
  for (const threat of sourceThreats) {
    const titleLower = threat.title.toLowerCase();
    
    // Simple duplicate check
    if (mergedContent.toLowerCase().includes(titleLower)) {
      skippedCount++;
      continue;
    }
    
    // Add the threat to the end of the content
    if (!mergedContent.endsWith('\n\n')) {
      mergedContent += '\n\n';
    }
    
    mergedContent += threat.content;
    addedCount++;
  }
  
  return { mergedContent, addedCount, skippedCount };
}

// --- Bidirectional batch merge endpoint ---
const { mergeThreatModels: mergeThreatModelsV2 } = require('../../services/threatModelMergeServiceV2');

router.post('/merge-batch', ensureAuthenticated, async (req, res) => {
  const requestId = uuidv4();
  try {
    const { primaryId, sourceIds, mergedContent, selectedThreatTitles } = req.body;
    if (!primaryId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required parameters (primaryId, sourceIds)' });
    }
    // Optionally get user info
    const mergedBy = req.user && req.user.username ? req.user.username : 'unknown';
    // Call the V2 merge service
    const result = await mergeThreatModelsV2(primaryId, sourceIds, mergedBy, mergedContent, selectedThreatTitles);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error(`[${requestId}] Error in merge-batch endpoint:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
