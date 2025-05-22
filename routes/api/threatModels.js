const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const threatModelService = require('../../services/threatModelService');
const ollamaUtil = require('../../utils/ollama');
const { ensureAuthenticated } = require('../../middleware/auth');

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

module.exports = router;
