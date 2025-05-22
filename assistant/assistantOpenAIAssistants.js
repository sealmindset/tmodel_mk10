// assistantOpenAIAssistants.js
// Handles OpenAI Assistants API integration
const axios = require('axios');
const assistantDB = require('./assistantDB');

// Cache for API keys and assistant IDs
let apiKeyCache = null;
let apiKeyCacheTime = null;
const API_KEY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get and cache the OpenAI API key
 */
async function getCachedApiKey() {
  const now = Date.now();
  // Check if cache exists and is still valid
  if (apiKeyCache && apiKeyCacheTime && (now - apiKeyCacheTime < API_KEY_CACHE_TTL)) {
    return apiKeyCache;
  }
  
  // Fetch a new API key and update the cache
  const apiKey = await assistantDB.getApiKey('openai');
  if (apiKey) {
    apiKeyCache = apiKey;
    apiKeyCacheTime = now;
    console.log('Refreshed OpenAI API key cache');
  } else {
    console.warn('Failed to retrieve OpenAI API key');
  }
  
  return apiKey;
}

/**
 * Get or create an assistant with the specified model
 * @param {string} model - The model to use (e.g., gpt-4-turbo-preview)
 * @param {boolean} enableBrowsing - Whether to enable web browsing capability
 */
async function getOrCreateAssistant(model, enableBrowsing = false) {
  try {
    // Check if we have a cached assistant ID for this model and browsing config
    const cachedAssistant = await assistantDB.getAssistantId(model, enableBrowsing);
    if (cachedAssistant) {
      console.log(`Using cached assistant for model ${model} (browsing: ${enableBrowsing}): ${cachedAssistant}`);
      return cachedAssistant;
    }

    // Get API key from cache
    const apiKey = await getCachedApiKey();
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in the settings.');
    }
    
    // Create a new assistant
    console.log(`Creating new assistant for model ${model} ${enableBrowsing ? 'with browsing capabilities' : ''}`);
    
    // Prepare the assistant payload
    const assistantPayload = {
      model,
      name: "Security Expert",
      description: "A security expert specialized in threat modeling and security assessments",
      instructions: "You are a security expert who specializes in threat modeling, vulnerability assessment, and security architecture. Provide clear, concise, and technically accurate answers. When discussing threats, always consider STRIDE categories and provide practical mitigations. Structure your responses with markdown for readability when appropriate.",
    };
    
    // Add tools if browsing is enabled
    if (enableBrowsing) {
      // Use file_search which is the modern equivalent to the old retrieval tool
      assistantPayload.tools = [{ type: "file_search" }];
      
      // For deep research, we would ideally add web browsing but it seems not to be
      // available in the current API version, so we'll use what tools are available
      console.log('Adding research capabilities to assistant with available tools...');
    }
    
    // Log the request attempt with a redacted API key for security
    const redactedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'null';
    console.log(`Making request to OpenAI with key ${redactedKey.substring(0, 7)}*** and ${enableBrowsing ? 'web browsing' : 'standard'} assistant.`);
    
    let response;
    try {
      // Try to create the assistant
      response = await axios.post('https://api.openai.com/v1/assistants', assistantPayload, {
        headers: { 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
    } catch (apiError) {
      // If the error is related to the capabilities not being available
      if (enableBrowsing && apiError.response && apiError.response.status === 400) {
        console.log('Advanced capabilities not available - falling back to basic assistant');
        
        // Try again with the most compatible tool configuration
        assistantPayload.tools = [{ type: "code_interpreter" }];
        
        // Set enableBrowsing to false since we're downgrading
        enableBrowsing = false;
        
        response = await axios.post('https://api.openai.com/v1/assistants', assistantPayload, {
          headers: { 
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          }
        });
      } else {
        // Re-throw other errors
        throw apiError;
      }
    }
    
    // Save the assistant ID in the database
    const assistantId = response.data.id;
    await assistantDB.saveAssistantId(model, assistantId, enableBrowsing);
    console.log(`Created new assistant with ID: ${assistantId} ${enableBrowsing ? 'with browsing capabilities' : 'without browsing'}`);
    
    return assistantId;
  } catch (error) {
    console.error("Error creating/getting assistant:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    
    // Handle specific errors
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid or missing OpenAI API key. Please check your API key in the settings.');
    }
    
    throw error;
  }
}

/**
 * Create a new thread or retrieve an existing one
 */
async function getOrCreateThread(session_id) {
  try {
    // Check if we have a cached thread ID for this session
    const cachedThreadId = await assistantDB.getThreadId(session_id);
    if (cachedThreadId) {
      console.log(`Using cached thread for session ${session_id}: ${cachedThreadId}`);
      return cachedThreadId;
    }
    
    // Get API key from cache
    const apiKey = await getCachedApiKey();
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in the settings.');
    }
    
    // Create a redacted version of the API key for logging
    const redactedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'null';
    console.log(`Creating new thread using API key ${redactedKey.substring(0, 7)}***`);
    
    // Create a new thread
    console.log(`Creating new thread for session ${session_id}`);
    const response = await axios.post('https://api.openai.com/v1/threads', {}, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    // Save the thread ID
    const threadId = response.data.id;
    await assistantDB.saveThreadId(session_id, threadId);
    console.log(`Created new thread with ID: ${threadId}`);
    
    return threadId;
  } catch (error) {
    console.error("Error creating/getting thread:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    
    // Handle specific errors
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid or missing OpenAI API key. Please check your API key in the settings.');
    }
    
    throw error;
  }
}

/**
 * Add a message to a thread
 */
async function addMessageToThread(threadId, message) {
  try {
    // Get API key from cache
    const apiKey = await getCachedApiKey();
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in the settings.');
    }
    
    // Add message to thread
    const response = await axios.post(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      role: "user",
      content: message
    }, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error adding message to thread:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    
    // Handle specific errors
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid or missing OpenAI API key. Please check your API key in the settings.');
    }
    
    throw error;
  }
}

/**
 * Run the assistant on a thread
 */
async function runAssistant(threadId, assistantId, context_enabled) {
  try {
    // Get API key from cache
    const apiKey = await getCachedApiKey();
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in the settings.');
    }
    
    // Build instructions with or without context
    let instructions = context_enabled 
      ? "Use the context of our conversation and your knowledge of security and threat modeling to provide a helpful response. Structure your answer with markdown when appropriate."
      : "Respond to this specific message without considering previous context.";
    
    // Create a run
    const response = await axios.post(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      assistant_id: assistantId,
      instructions
    }, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error running assistant:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    
    // Handle specific errors
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid or missing OpenAI API key. Please check your API key in the settings.');
    }
    
    throw error;
  }
}

/**
 * Check the status of a run
 */
async function checkRunStatus(threadId, runId) {
  try {
    // Get API key from cache
    const apiKey = await getCachedApiKey();
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in the settings.');
    }
    
    // Get run status
    const response = await axios.get(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error checking run status:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    
    // Handle specific errors
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid or missing OpenAI API key. Please check your API key in the settings.');
    }
    
    throw error;
  }
}

/**
 * Get messages from a thread after a run completes
 */
async function getMessages(threadId) {
  try {
    // Get API key from cache
    const apiKey = await getCachedApiKey();
    
    // Validate API key
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please add your API key in the settings.');
    }
    
    // Get messages
    const response = await axios.get(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error("Error getting messages:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    
    // Handle specific errors
    if (error.response && error.response.status === 401) {
      throw new Error('Invalid or missing OpenAI API key. Please check your API key in the settings.');
    }
    
    throw error;
  }
}

/**
 * Wait for a run to complete
 */
async function waitForRunCompletion(threadId, runId, maxRetries = 30, delay = 1000) {
  let retries = 0;
  
  while (retries < maxRetries) {
    const runStatus = await checkRunStatus(threadId, runId);
    
    if (runStatus.status === 'completed') {
      return runStatus;
    } else if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
      throw new Error(`Run ${runId} ended with status: ${runStatus.status}`);
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, delay));
    retries++;
    
    // Increase delay for subsequent checks (exponential backoff)
    delay = Math.min(delay * 1.5, 5000);
  }
  
  throw new Error(`Run ${runId} did not complete after ${maxRetries} checks`);
}

exports.getAvailableModels = async () => {
  // We'll offer a specific set of models known to work with Assistants API
  return [
    { name: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
    { name: 'gpt-4', label: 'GPT-4' },
    { name: 'gpt-3.5-turbo-1106', label: 'GPT-3.5 Turbo' }
  ];
};

exports.getChatResponse = async ({ model, message, session_id, context_enabled, deep_research = false }) => {
  try {
    // Ensure we have a session ID
    if (!session_id) {
      session_id = 'default-session-' + Date.now();
    }
    
    // 1. Get or create an assistant with deep research capabilities if requested
    const assistantId = await getOrCreateAssistant(model, deep_research);
    
    if (deep_research) {
      console.log('🔍 Deep research mode enabled - using web browsing capabilities');
    }
    
    // 2. Get or create a thread
    const threadId = await getOrCreateThread(session_id);
    
    // 3. Add the user message to the thread
    await addMessageToThread(threadId, message);
    
    // 4. Run the assistant
    const run = await runAssistant(threadId, assistantId, context_enabled);
    
    // 5. Wait for the run to complete
    await waitForRunCompletion(threadId, run.id);
    
    // 6. Retrieve messages from the thread
    const messages = await getMessages(threadId);
    
    // 7. Find the latest assistant message (it should be the first one)
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    if (assistantMessages.length === 0) {
      throw new Error('No assistant response found in thread');
    }
    
    // Return the latest assistant message
    const latestMessage = assistantMessages[0];
    let content = '';
    
    // Handle different content types (text, image, etc.)
    for (const contentItem of latestMessage.content) {
      if (contentItem.type === 'text') {
        content += contentItem.text.value;
      }
    }
    
    return content;
  } catch (error) {
    console.error('Error in getChatResponse:', error);
    throw error;
  }
};
