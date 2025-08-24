// assistantController.js
// Handles all chat logic, provider selection, and mirror mode
const assistantDB = require('./assistantDB');
const assistantOllama = require('./assistantOllama');
// Import both OpenAI implementations
const assistantOpenAI = require('./assistantOpenAI');
const assistantOpenAIAssistants = require('./assistantOpenAIAssistants');

// POST /chat
exports.handleChat = async (req, res) => {
  try {
    // Debug request information
    console.log('=== REQUEST DEBUG INFO ===');
    console.log('Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request body received:', req.body);
    console.log('Body is null or undefined:', req.body === null || req.body === undefined);
    console.log('Body type:', typeof req.body);
    console.log('Request query params:', req.query);
    console.log('Request path:', req.path);
    console.log('=== END DEBUG INFO ===');
    
    // Ensure req.body exists and provide default values
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, error: "Request body is missing or empty" });
    }

    const { 
      provider = 'openai', 
      model = 'gpt-4o', 
      ollamaModel = 'llama4:latest',  
      openaiModel = 'gpt-4o',  
      message = '', 
      mirrorMode = false, 
      context_enabled = true,
      deep_research = false,
      session_id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      user_id = 'anonymous'
    } = req.body;

    // Use the specific provider model or fallback to the generic model parameter for backwards compatibility
    const effectiveOpenAIModel = openaiModel || model;
    const effectiveOllamaModel = ollamaModel || 'llama4:latest';

    // Check for required message
    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }
    
    // Log the request
    console.log(`Chat request: provider=${provider}, model=${model}, mirrorMode=${mirrorMode}, context_enabled=${context_enabled}, session_id=${session_id}`);
    
    let responses = {};
    
    if (mirrorMode) {
      // Call both providers using the effective model parameters
      // Log mirror mode configuration
      console.log(`Mirror mode enabled. Using model ${effectiveOpenAIModel} for OpenAI and ${effectiveOllamaModel} for Ollama`);
      
      try {
        // In mirror mode, still respect deep_research flag for OpenAI
        responses.openai = await assistantOpenAIAssistants.getChatResponse({ 
          model: effectiveOpenAIModel, 
          message, 
          session_id, 
          context_enabled,
          deep_research 
        });
      } catch (openaiErr) {
        console.error('Error with OpenAI:', openaiErr);
        responses.openai = `⚠️ OpenAI Error: ${openaiErr.message}`;
      }
      
      try {
        responses.ollama = await assistantOllama.getChatResponse({ 
          model: effectiveOllamaModel, 
          message, 
          context_enabled 
        });
      } catch (ollamaErr) {
        console.error('Error with Ollama:', ollamaErr);
        responses.ollama = `⚠️ Ollama Error: ${ollamaErr.message}`;
      }
    } else if (provider === 'openai') {
      // Validate model is available to reduce OpenAI 400s due to unsupported model IDs
      try {
        const available = await assistantOpenAIAssistants.getAvailableModels();
        const availableIds = new Set((available || []).map(m => m.name));
        if (!availableIds.has(model)) {
          const fallback = available[0]?.name || 'gpt-4o';
          console.warn(`[assistant] Requested OpenAI model "${model}" not in available list; falling back to "${fallback}"`);
          model = fallback;
        }
      } catch (e) {
        console.warn('[assistant] Failed to validate OpenAI model list; proceeding with requested model:', e.message);
      }
      try {
        // Log if deep research is enabled
        if (deep_research) {
          console.log(`Deep research enabled for OpenAI query with model ${model}`);
        }
        
        responses.openai = await assistantOpenAIAssistants.getChatResponse({ 
          model, 
          message, 
          session_id, 
          context_enabled,
          deep_research 
        });
      } catch (error) {
        console.error('Error with OpenAI:', error);
        
        // Provide user-friendly error message
        let errorMessage = error.message;
        if (error.message.includes('API key')) {
          errorMessage = "⚠️ OpenAI API key issue detected. Please go to Settings and add a valid API key.";
        }
        
        responses.openai = errorMessage;
      }
    } else if (provider === 'ollama') {
      try {
        responses.ollama = await assistantOllama.getChatResponse({ 
          model, 
          message, 
          context_enabled 
        });
      } catch (error) {
        console.error('Error with Ollama:', error);
        
        // Provide user-friendly error message
        let errorMessage = error.message;
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = "⚠️ Cannot connect to Ollama. Please make sure the Ollama service is running locally.";
        }
        
        responses.ollama = errorMessage;
      }
    }
    
    // Save to chat history
    await assistantDB.saveChatHistory({ 
      user_id, 
      session_id, 
      provider, 
      model, 
      user_message: message, 
      ai_response: JSON.stringify(responses) 
    });
    
    res.json({ success: true, responses });
  } catch (err) {
    console.error('Error in handleChat:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /models
exports.getModels = async (req, res) => {
  try {
    const { provider } = req.query;
    let models = [];
    
    if (provider === 'openai') {
      models = await assistantOpenAIAssistants.getAvailableModels();
    } else if (provider === 'ollama') {
      models = await assistantOllama.getAvailableModels();
    }
    
    res.json({ success: true, models });
  } catch (err) {
    console.error('Error in getModels:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /history
exports.getHistory = async (req, res) => {
  try {
    const { user_id, session_id } = req.query;
    const history = await assistantDB.getChatHistory({ user_id, session_id });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /settings
exports.saveSettings = async (req, res) => {
  try {
    const { user_id, session_id, mirror_mode, context_enabled } = req.body;
    await assistantDB.saveSettings({ user_id, session_id, mirror_mode, context_enabled });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
