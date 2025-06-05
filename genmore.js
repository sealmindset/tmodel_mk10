const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('./middleware/ensureAuthenticated');

const axios = require('axios');
const openaiUtil = require('./utils/openai');
const ollamaUtil = require('./utils/ollama');

// Debug logging to confirm Ollama utility is loaded
console.log('Exporting genmore router:', typeof router);

router.post('/generate-more', ensureAuthenticated, async (req, res) => {
  const { subjectid } = req.body;
  const userEmail = req.user.email;
  const debugData = {};

  try {
    console.log(`----- GENERATE MORE DEBUG -----`);
    console.log(`Generate-more request for subject ${subjectid} by user ${userEmail}`);
    
    // Get the original prompt used to generate the initial response
    const promptService = require('./services/promptService');
const threatModelService = require('./services/threatModelService');

// Fetch the promptId from the threat model
const threatModel = await threatModelService.getThreatModel(subjectid);
const promptId = threatModel && threatModel.pgRecord && threatModel.pgRecord.prompt_id ? threatModel.pgRecord.prompt_id : null;

// Local helper to retrieve model for a threat model by UUID
async function getModel(subjectid) {
  const threatModel = await threatModelService.getThreatModel(subjectid);
  return threatModel && threatModel.pgRecord && threatModel.pgRecord.model ? threatModel.pgRecord.model : null;
}
    console.log(`Found prompt ID: ${promptId || 'NONE'}`);  
    
    let originalPrompt = "";
    if (promptId) {
      if (promptId) {
  const promptRecord = await promptService.getPromptById(promptId);
  originalPrompt = promptRecord ? promptRecord.prompt_text : '';
}
      console.log(`Original prompt found: ${originalPrompt ? 'YES (length: ' + originalPrompt.length + ')' : 'NO'}`); 
      debugData.originalPromptId = promptId;
      debugData.originalPrompt = originalPrompt;
    }

    // Get the LLM provider and model first
    // Fetch LLM provider from threat model record or default
    let llmProvider = threatModel && threatModel.pgRecord && threatModel.pgRecord.llm_provider ? threatModel.pgRecord.llm_provider : 'openai';

    // Set isOllama flag - this determines which API we'll use
    const isOllama = llmProvider === 'ollama';
    debugData.llmProvider = llmProvider;
    debugData.isOllama = isOllama;
    
    // Get appropriate model based on provider
    let model;
    if (isOllama) {
      model = threatModel && threatModel.pgRecord && threatModel.pgRecord.model ? threatModel.pgRecord.model : 'llama3.3';
    } else {
      model = threatModel && threatModel.pgRecord && threatModel.pgRecord.model ? threatModel.pgRecord.model : 'gpt-3.5-turbo';
    }
    console.log(`Using model: ${model} for provider: ${llmProvider}`);
    
    // Only check for API key if using OpenAI
    // llmProvider is now always tracked in debug and requestData for LLM routing
    let apiKey = null;
    if (!isOllama) {
      // Use our improved OpenAI API key retrieval system
      apiKey = await openaiUtil.getApiKey();
      
      console.log('Using OpenAI API key for summary generation:', apiKey ? 'Key found' : 'No key found');
      
      if (!apiKey) {
        debugData.error = 'No API key available for OpenAI';
        
        return res.json({
          success: false,
          error: 'OpenAI API Key not found. Please check your API key settings or switch to Ollama provider in settings.',
          debug: debugData
        });
      }
      
      // Determine the source of the API key
      const keyHealth = await openaiUtil.verifyApiKey();
      debugData.apiKeySource = keyHealth.source;
    }
    console.log(`API key source: ${debugData.apiKeySource}`);

    // Get the subject text
    const subjectText = await threatModelService.getSubjectText(subjectid);
    console.log(`Subject text found: ${subjectText ? 'YES (length: ' + subjectText.length + ')' : 'NO'}`);
    debugData.subjectText = subjectText;

    // Get the existing response and model
    console.log('Fetching existing response and model...');
    const existingResponse = threatModel && threatModel.pgRecord && threatModel.pgRecord.response_text ? threatModel.pgRecord.response_text : '';
    if (!existingResponse) {
      console.log('No existing response found for this subject');
      debugData.error = 'No existing response found';
      
      return res.json({
        success: false,
        error: 'No existing response found for this subject.',
        debug: debugData
      });
    }
    console.log(`Existing response found: (length: ${existingResponse.length})`);
    debugData.existingResponseLength = existingResponse.length;
    
    // We already have the LLM provider and model from earlier
    console.log(`Using previously determined LLM provider: ${llmProvider}`);
    debugData.llmProvider = llmProvider;
    debugData.isOllama = isOllama;
    
    // Fallback to model used in original request if available
    const originalModel = await getModel(subjectid);
    if (originalModel) {
      // Only use the original model if it matches the current provider type
      const isOriginalModelOllama = originalModel.includes('llama') || originalModel.includes('mistral');
      if (isOllama === isOriginalModelOllama) {
        model = originalModel;
      }
    }
    
    console.log(`Using model: ${model} with provider: ${llmProvider}`);
    debugData.model = model;
    debugData.isOllama = isOllama;

    // Improved prompt templates as constants for better cross-provider consistency
    const PROMPT_TEMPLATE_WITH_ORIGINAL = (originalPrompt, subjectText, existingResponse) =>
      `You are a security expert performing threat modeling. Your task is to continue the existing threat analysis with NEW and DISTINCT threats that have not yet been covered.

Begin by using this prompt that was initially used for creating this threat model:

${originalPrompt}

You must analyze security threat models for "${subjectText}". You MUST:
1. Generate only NEW threat models not already covered in the existing analysis
2. Ensure each threat model is distinct without repeating concepts
3. Follow the EXACT same format as the existing threat models
4. Include all fields present in the existing models: Title, Description, TTPs, Risk, Real-World Example, Impact, Threat Actor, etc.
5. Write in a technical, concise, professional style

Do not say you're continuing the analysis or reference the request. Just provide the new threat models directly, starting with "## Threat: [Name] ##"

Existing threat models that you MUST NOT duplicate:

${existingResponse}`;
    
    const PROMPT_TEMPLATE_FALLBACK = (existingResponse) =>
      `You are a security expert performing threat modeling. Your task is to continue the existing threat analysis with NEW and DISTINCT threats that have not yet been covered.

You MUST:
1. Generate only NEW threat models not already covered in the existing analysis
2. Ensure each threat model is distinct without repeating concepts
3. Follow the EXACT same format as the existing threat models
4. Include all fields present in the existing models: Title, Description, TTPs, Risk, Real-World Example, Impact, Threat Actor, etc.
5. Write in a technical, concise, professional style

Do not say you're continuing the analysis or reference the request. Just provide the new threat models directly, starting with "## Threat: [Name] ##"

Existing threat models that you MUST NOT duplicate:

${existingResponse}`;

    // Build prompt and log every step - IDENTICAL APPROACH FOR BOTH OLLAMA AND OPENAI
    // We prioritize using the original prompt whenever possible
    let prompt;
    if (originalPrompt && subjectText) {
      console.log('[generate-more] Building prompt with original prompt, subject, and existing response');
      prompt = PROMPT_TEMPLATE_WITH_ORIGINAL(originalPrompt, subjectText, existingResponse);
      debugData.promptType = 'original+subject+existing';
    } else {
      console.log('[generate-more] Building fallback prompt (existing response only)');
      prompt = PROMPT_TEMPLATE_FALLBACK(existingResponse);
      debugData.promptType = 'fallback';
    }
    
    // Log the full prompt for debugging and ensure we're using the same approach for both providers
    console.log(`[generate-more] Using prompt template: ${debugData.promptType}`);
    console.log(`[generate-more] Provider: ${llmProvider}, Model: ${model}`);
    console.log(`[generate-more] Has original prompt: ${Boolean(originalPrompt)}`);
    console.log(`[generate-more] Has subject text: ${Boolean(subjectText)}`);
    
    console.log(`[generate-more] Prompt length: ${prompt.length}`);
    // Log the full prompt for better debugging
    console.log('[generate-more] ================ FULL PROMPT ================');
    console.log(prompt);
    console.log('[generate-more] ============= END OF FULL PROMPT =============');
    debugData.promptUsed = prompt;

    // Make API request with exact same structure as working version
    // llmProvider is included for LLM selection or analytics, but NOT sent to OpenAI
    let requestData = {
      model,
      messages: [{ role: 'user', content: prompt }]
    };
    // For debugging, include llmProvider in debugData only
    debugData.requestData = { ...requestData, llmProvider };
    debugData.llmProvider = llmProvider;

    console.log('Sending API request with model:', model);
    console.log('Message length:', prompt.length, 'characters');
    
    let response;
    let newResponse;
    
    if (isOllama) {
      // Use Ollama API
      console.log('Sending request to Ollama API...');
      
      try {
        // Check if Ollama is available
        const ollamaStatus = await ollamaUtil.checkStatus();
        if (!ollamaStatus) {
          throw new Error('Ollama service is not available. Please check if Ollama is running.');
        }
        
        // Explicitly log the Ollama API request event to the monitor
        ollamaUtil.logApiEvent('request', {
          model,
          prompt: prompt.substring(0, 500) + '...', // Truncate for monitoring
          type: 'completion',
          timestamp: new Date().toISOString(),
          source: 'generate-more',
          usesCag: true, // This uses contextual generation
          usesRag: originalPrompt ? true : false // Uses RAG if original prompt is available
        });

        // Use the Ollama utility to send the request
        const ollamaResponse = await ollamaUtil.getCompletion(prompt, model);
        
        debugData.responseReceived = true;
        // Only log a truncated version of the response for debugging
        debugData.rawResponse = typeof ollamaResponse === 'string' 
          ? ollamaResponse.substring(0, 1000) + '...' 
          : JSON.stringify(ollamaResponse).substring(0, 1000) + '...';
        
        console.log('Response received from Ollama API');
        console.log('Ollama response structure:', typeof ollamaResponse === 'string' 
          ? JSON.stringify(ollamaResponse.substring(0, 200)) + '...' 
          : JSON.stringify(ollamaResponse).substring(0, 200) + '...');
        
        // Explicitly log the Ollama API response event
        ollamaUtil.logApiEvent('response', {
          source: 'generate-more',
          timestamp: new Date().toISOString(),
          responseType: typeof ollamaResponse
        });

        // Extract the response from Ollama's response structure
        // Handle different possible response formats from Ollama
        if (typeof ollamaResponse === 'string') {
          // Handle case where response is a string (raw text)
          newResponse = ollamaResponse;
          console.log('[OLLAMA] Successfully extracted response from string format');
        }
        // Prioritize Ollama's native format (which has a 'response' field)
        else if (ollamaResponse.response) {
          newResponse = ollamaResponse.response;
          console.log('[OLLAMA] Successfully extracted response from Ollama native format');
        } 
        // Handle streaming response that might have been concatenated
        else if (typeof ollamaResponse === 'object' && Object.prototype.toString.call(ollamaResponse) === '[object Object]') {
          console.log('[OLLAMA] Examining object response structure:', Object.keys(ollamaResponse).join(', '));
          
          // Fallback to OpenAI formats
          if (ollamaResponse.choices && ollamaResponse.choices.length > 0 && ollamaResponse.choices[0].text) {
            newResponse = ollamaResponse.choices[0].text;
            console.log('[OLLAMA] Extracted response from OpenAI completion format');
          } else if (ollamaResponse.choices && ollamaResponse.choices.length > 0 && ollamaResponse.choices[0].message?.content) {
            newResponse = ollamaResponse.choices[0].message.content;
            console.log('[OLLAMA] Extracted response from OpenAI chat format');
          } else {
            // Last resort: try to extract any text-like field from the response
            const possibleTextFields = ['content', 'text', 'completion', 'generated_text', 'output'];
            for (const field of possibleTextFields) {
              if (ollamaResponse[field] && typeof ollamaResponse[field] === 'string') {
                newResponse = ollamaResponse[field];
                console.log(`[OLLAMA] Extracted response from field: ${field}`);
                break;
              }
            }
            
            if (!newResponse) {
              console.error('[OLLAMA] Response format not recognized:', JSON.stringify(ollamaResponse, null, 2).substring(0, 500));
              throw new Error('Unable to extract response content from Ollama API response');
            }
          }
        } else {
          console.error('[OLLAMA] Response is neither string nor object:', typeof ollamaResponse);
          throw new Error('Unexpected response type from Ollama API');
        }
      } catch (error) {
        console.error('----- GENERATE MORE ERROR -----');
        console.error('Error with Ollama API:', error.message);
        throw error; // Let the catch block handle this
      }
    } else {
      // Use OpenAI API (llmProvider === 'openai')
      console.log('Sending request to OpenAI API...');
      
      // Explicitly log the API request event to the monitor
      openaiUtil.logApiEvent('request', {
        model,
        prompt: prompt.substring(0, 500) + '...', // Truncate for monitoring
        type: 'chat',
        maxTokens: requestData.max_tokens || 2048,
        timestamp: new Date().toISOString(),
        source: 'generate-more'
      });

      response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Response received from OpenAI API');
      debugData.responseReceived = true;
      debugData.rawResponse = response.data;
      
      // Explicitly log the API response event to the monitor
      openaiUtil.logApiEvent('response', {
        ...response.data,
        source: 'generate-more',
        timestamp: new Date().toISOString()
      });

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        console.error('Unexpected response format:', JSON.stringify(response.data));
        debugData.error = 'Invalid response format';
        
        return res.json({
          success: false,
          error: 'Invalid response format from OpenAI API',
          debug: debugData
        });
      }

      // Process the OpenAI response
      newResponse = response.data.choices[0].message.content;
    }
    
    // Process the response and update PostgreSQL
    console.log(`New response received: (length: ${newResponse.length})`);
    console.log('First 100 chars:', newResponse.substring(0, 100));
    debugData.newResponseLength = newResponse.length;
    debugData.newResponsePreview = newResponse.substring(0, 100);
    
    const updatedResponse = `${existingResponse}\n\n---\n\n${newResponse}`.trim();

    console.log(`Saving updated response (${updatedResponse.length} chars) to PostgreSQL...`);
    await threatModelService.updateThreatModel(subjectid, { response_text: updatedResponse });
    debugData.success = true;
    
    
    // Instead of redirecting, respond with JSON for debugging
    return res.json({
      success: true,
      message: 'Successfully generated more threats',
      redirect: `/results?subjectid=${encodeURIComponent(subjectid)}`,
      debug: {
        promptLength: prompt.length,
        newResponseLength: newResponse.length,
        newResponsePreview: newResponse.substring(0, 200),
        subjectId: subjectid
      }
    });



  } catch (error) {
    console.error('----- GENERATE MORE ERROR -----');
    console.error('Error generating more results:', error.message);
    debugData.error = error.message;
    
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data));
      console.error('Response status:', error.response.status);
      debugData.responseError = {
        data: error.response.data,
        status: error.response.status
      };
    }
    
    
    console.error('----- END GENERATE MORE ERROR -----');
    
    return res.json({
      success: false,
      error: `Error generating more results: ${error.message}`,
      debug: debugData
    });



  }
});
console.log('Exporting genmore router:', typeof router, router.stack ? 'router' : 'NOT ROUTER');
module.exports = router;