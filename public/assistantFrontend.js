// assistantFrontend.js
// Handles persistent button, modal, chat logic, provider/mirror mode selection
// Loads on every page

console.log('🔵 AI Assistant: Frontend script loaded');

(function() {
  console.log('🔵 AI Assistant: Frontend script executing');
  // Generate a unique session ID if one doesn't exist
  function getSessionId() {
    let sessionId = localStorage.getItem('assistant_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('assistant_session_id', sessionId);
    }
    return sessionId;
  }
  
  // Initialize session ID
  let sessionId = getSessionId();
  console.log('Using assistant session ID:', sessionId);
  
  // Function to create a new thread/session
  function createNewThread() {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem('assistant_session_id', sessionId);
    console.log('Created new thread with session ID:', sessionId);
    
    // Clear the chat history display
    const chatHistory = document.getElementById('assistant-chat-history');
    chatHistory.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">New conversation started</div>';
    
    // Show a notification
    const notification = document.createElement('div');
    notification.innerText = 'New conversation thread created';
    notification.style.position = 'fixed';
    notification.style.bottom = '75px';
    notification.style.right = '24px';
    notification.style.background = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '10001';
    document.body.appendChild(notification);
    
    // Remove the notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s';
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 3000);
  }
  
  // Create floating button
  const btn = document.createElement('button');
  btn.id = 'assistant-float-btn';
  btn.innerText = 'AI Assistant';
  btn.style.position = 'fixed';
  btn.style.bottom = '24px';
  btn.style.right = '24px';
  btn.style.zIndex = '9999';
  btn.style.background = '#3a3a3a';
  btn.style.color = 'white';
  btn.style.border = 'none';
  btn.style.borderRadius = '50px';
  btn.style.padding = '14px 22px';
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  btn.style.cursor = 'pointer';
  document.body.appendChild(btn);

  // Modal HTML (loaded from EJS in prod, here for dev)
  let modal = document.getElementById('assistant-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'assistant-modal';
    modal.innerHTML = `<div style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;" id="assistant-modal-bg">
      <div style="background:white;padding:24px;border-radius:10px;min-width:320px;max-width:90vw;max-height:80vh;overflow:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;">AI Chat Assistant</h3>
          <button id="assistant-modal-close" style="background:none;border:none;font-size:1.5em;">&times;</button>
        </div>
        <div style="margin-bottom:12px;">
          <div id="single-provider-controls">
            <label>Provider:</label>
            <select id="assistant-provider">
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
            <label style="margin-left:12px;">Model:</label>
            <select id="assistant-model"></select>
          </div>
          <div id="mirror-mode-controls" style="display:none;">
            <div>
              <label>OpenAI Model:</label>
              <select id="assistant-openai-model"></select>
            </div>
            <div style="margin-top:8px;">
              <label>Ollama Model:</label>
              <select id="assistant-ollama-model"></select>
            </div>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label><input type="checkbox" id="assistant-mirror-mode"> Mirror Mode (Show both)</label>
          <label style="margin-left:16px;"><input type="checkbox" id="assistant-context-enabled"> Contextual Awareness</label>
          <div id="deep-research-container" style="margin-top:8px; display:none;">
            <label><input type="checkbox" id="assistant-deep-research"> Deep Research (Web browsing)</label>
            <small style="display:block; color:#666; margin-top:2px;">Enables web search capabilities for multi-step research (OpenAI models only)</small>
          </div>
          <div style="margin-top:12px; text-align:right;">
            <button id="new-thread-button" style="padding:6px 12px; border-radius:4px; background:#f0f0f0; border:1px solid #ccc; cursor:pointer;">
              <span style="margin-right:4px;">🔄</span> New Thread
            </button>
            <small style="display:block; color:#666; margin-top:2px;">Starts a fresh conversation with no previous context</small>
          </div>
        </div>
        <div id="assistant-chat-history" style="background:#f4f4f4;padding:12px;height:180px;overflow-y:auto;margin-bottom:12px;border-radius:6px;font-size:0.98em;"></div>
        <div style="display:flex;gap:8px;">
          <input id="assistant-chat-input" type="text" placeholder="Type your message..." style="flex:1;padding:8px;border-radius:4px;border:1px solid #ccc;">
          <button id="assistant-chat-send" style="padding:8px 14px;border-radius:4px;background:#3a3a3a;color:white;border:none;">Send</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }

  const modalBg = document.getElementById('assistant-modal-bg');
  btn.onclick = () => { 
    modalBg.style.display = 'flex'; 
    loadModels(); 
    loadHistory(); 
    updateDeepResearchVisibility(); // Initialize deep research visibility
  };
  document.getElementById('assistant-modal-close').onclick = () => { modalBg.style.display = 'none'; };
  document.getElementById('new-thread-button').onclick = createNewThread;

  // Provider/model logic
  const singleProviderControls = document.getElementById('single-provider-controls');
  const mirrorModeControls = document.getElementById('mirror-mode-controls');
  const providerSelect = document.getElementById('assistant-provider');
  const modelSelect = document.getElementById('assistant-model');
  const openaiModelSelect = document.getElementById('assistant-openai-model');
  const ollamaModelSelect = document.getElementById('assistant-ollama-model');
  const mirrorModeCheckbox = document.getElementById('assistant-mirror-mode');
  const contextCheckbox = document.getElementById('assistant-context-enabled');
  const deepResearchContainer = document.getElementById('deep-research-container');
  const deepResearchCheckbox = document.getElementById('assistant-deep-research');
  
  // Function to toggle Deep Research visibility
  function updateDeepResearchVisibility() {
    const currentProvider = mirrorModeCheckbox.checked ? 'openai' : providerSelect.value;
    const isOpenAI = currentProvider === 'openai';
    deepResearchContainer.style.display = isOpenAI ? 'block' : 'none';
  }
  
  providerSelect.onchange = () => {
    loadModelsForProvider(providerSelect.value, modelSelect);
    updateDeepResearchVisibility();
  };
  
  mirrorModeCheckbox.onchange = () => {
    // Toggle visibility of controls based on mirror mode
    singleProviderControls.style.display = mirrorModeCheckbox.checked ? 'none' : 'block';
    mirrorModeControls.style.display = mirrorModeCheckbox.checked ? 'block' : 'none';
    
    // Load models for both providers if mirror mode is enabled
    if (mirrorModeCheckbox.checked) {
      loadModelsForProvider('openai', openaiModelSelect);
      loadModelsForProvider('ollama', ollamaModelSelect);
    } else {
      loadModelsForProvider(providerSelect.value, modelSelect);
    }
    
    // Update deep research visibility
    updateDeepResearchVisibility();
  };

  async function loadModelsForProvider(provider, selectElement) {
    try {
      console.log(`Loading models for provider: ${provider}`);
      const res = await fetch(`/assistant/models?provider=${provider}`);
      const data = await res.json();
      
      // Clear existing options
      selectElement.innerHTML = '';
      
      // Add new options
      data.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name; 
        opt.text = m.label;
        selectElement.appendChild(opt);
      });
    } catch (error) {
      console.error(`Error loading models for ${provider}:`, error);
    }
  }
  
  async function loadModels() {
    // Load models for the currently selected provider in single mode
    loadModelsForProvider(providerSelect.value, modelSelect);
    
    // Pre-load both model types for mirror mode
    loadModelsForProvider('openai', openaiModelSelect);
    loadModelsForProvider('ollama', ollamaModelSelect);
  }

  async function loadHistory() {
    const res = await fetch(`/assistant/history?session_id=${sessionId}`);
    const data = await res.json();
    const chatDiv = document.getElementById('assistant-chat-history');
    chatDiv.innerHTML = '';
    (data.history || []).reverse().forEach(item => {
      chatDiv.innerHTML += `<div><b>You:</b> ${item.user_message}</div>`;
      try {
        const resp = JSON.parse(item.ai_response);
        if (resp.openai) chatDiv.innerHTML += `<div style='color:#004;'>OpenAI: ${resp.openai}</div>`;
        if (resp.ollama) chatDiv.innerHTML += `<div style='color:#080;'>Ollama: ${resp.ollama}</div>`;
      } catch { chatDiv.innerHTML += `<div>${item.ai_response}</div>`; }
    });
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }

  document.getElementById('assistant-chat-send').onclick = async function() {
    try {
      console.log('🔵 AI Assistant: Send button clicked');
      const input = document.getElementById('assistant-chat-input');
      const message = input.value.trim();
      if (!message) {
        console.log('🔵 AI Assistant: Empty message, not sending');
        return;
      }
      
      input.value = '';
      const mirrorMode = mirrorModeCheckbox.checked;
      const context_enabled = contextCheckbox.checked;
      
      // Create payload based on mode
      let payload;
      
      // Get deep research flag - only applies to OpenAI
      const deepResearch = deepResearchCheckbox.checked;
      
      if (mirrorMode) {
        // In mirror mode, use both model selectors
        const openaiModel = openaiModelSelect.value;
        const ollamaModel = ollamaModelSelect.value;
        
        payload = {
          provider: 'ollama', // This is ignored in mirror mode
          model: openaiModel, // For backwards compatibility
          openaiModel,
          ollamaModel,
          message,
          mirrorMode,
          context_enabled,
          deep_research: deepResearch, // Include deep research flag
          session_id: sessionId,
          user_id: 'frontend_user'
        };
        
        console.log('🔵 AI Assistant: Mirror mode with models:', { openaiModel, ollamaModel, deepResearch });
      } else {
        // In single provider mode
        const provider = providerSelect.value;
        const model = modelSelect.value;
        
        payload = { 
          provider, 
          model, 
          message, 
          mirrorMode, 
          context_enabled,
          deep_research: provider === 'openai' ? deepResearch : false, // Only enable for OpenAI
          session_id: sessionId,
          user_id: 'frontend_user'
        };
        
        if (provider === 'openai' && deepResearch) {
          console.log('🔵 AI Assistant: Deep research enabled');
        }
      }
      
      console.log('🔵 AI Assistant: Sending payload:', payload);
      
      // Show loading message
      const chatDiv = document.getElementById('assistant-chat-history');
      chatDiv.innerHTML += `<div><b>You:</b> ${message}</div>`;
      chatDiv.innerHTML += `<div id="assistant-loading-msg"><em>Assistant is thinking...</em></div>`;
      chatDiv.scrollTop = chatDiv.scrollHeight;
      
      // Stringified payload for logging/debugging
      const payloadStr = JSON.stringify(payload);
      console.log('🔵 AI Assistant: Stringified payload:', payloadStr);
      
      const res = await fetch('/assistant/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: payloadStr
      });
      
      console.log('🔵 AI Assistant: Got response with status:', res.status);
      const data = await res.json();
      console.log('🔵 AI Assistant: Got response data:', data);
      
      // Remove the loading message
      const loadingMsg = document.getElementById('assistant-loading-msg');
      if (loadingMsg) loadingMsg.remove();
      
      if (data.responses) {
        if (data.responses.openai) chatDiv.innerHTML += `<div style='color:#004;'>OpenAI: ${data.responses.openai}</div>`;
        if (data.responses.ollama) chatDiv.innerHTML += `<div style='color:#080;'>Ollama: ${data.responses.ollama}</div>`;
      } else {
        chatDiv.innerHTML += `<div style='color:red;'>Error: ${data.error || 'Unknown error'}</div>`;
      }
      chatDiv.scrollTop = chatDiv.scrollHeight;
    } catch (error) {
      console.error('🔵 AI Assistant: Error during chat:', error);
      const chatDiv = document.getElementById('assistant-chat-history');
      chatDiv.innerHTML += `<div style='color:red;'>Error: ${error.message || 'Network error'}</div>`;
      
      // Remove the loading message if it exists
      const loadingMsg = document.getElementById('assistant-loading-msg');
      if (loadingMsg) loadingMsg.remove();
    }
  };
})();
