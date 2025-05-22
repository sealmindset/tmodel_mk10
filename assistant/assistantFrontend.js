// assistantFrontend.js
// Handles persistent button, modal, chat logic, provider/mirror mode selection
// Loads on every page

(function() {
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
          <label>Provider:</label>
          <select id="assistant-provider">
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
          <label style="margin-left:12px;">Model:</label>
          <select id="assistant-model"></select>
        </div>
        <div style="margin-bottom:12px;">
          <label><input type="checkbox" id="assistant-mirror-mode"> Mirror Mode (Show both)</label>
          <label style="margin-left:16px;"><input type="checkbox" id="assistant-context-enabled"> Contextual Awareness</label>
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
  btn.onclick = () => { modalBg.style.display = 'flex'; loadModels(); loadHistory(); };
  document.getElementById('assistant-modal-close').onclick = () => { modalBg.style.display = 'none'; };

  // Provider/model logic
  const providerSelect = document.getElementById('assistant-provider');
  const modelSelect = document.getElementById('assistant-model');
  const mirrorModeCheckbox = document.getElementById('assistant-mirror-mode');
  const contextCheckbox = document.getElementById('assistant-context-enabled');
  providerSelect.onchange = loadModels;
  mirrorModeCheckbox.onchange = () => {
    providerSelect.disabled = mirrorModeCheckbox.checked;
    loadModels();
  };

  async function loadModels() {
    let provider = providerSelect.value;
    if (mirrorModeCheckbox.checked) provider = 'openai';
    const res = await fetch(`/assistant/models?provider=${provider}`);
    const data = await res.json();
    modelSelect.innerHTML = '';
    data.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name; opt.text = m.label;
      modelSelect.appendChild(opt);
    });
  }

  async function loadHistory() {
    const res = await fetch(`/assistant/history`);
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
    const input = document.getElementById('assistant-chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const mirrorMode = mirrorModeCheckbox.checked;
    const context_enabled = contextCheckbox.checked;
    const payload = { provider, model, message, mirrorMode, context_enabled };
    const chatDiv = document.getElementById('assistant-chat-history');
    chatDiv.innerHTML += `<div><b>You:</b> ${message}</div>`;
    chatDiv.scrollTop = chatDiv.scrollHeight;
    const res = await fetch('/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.responses) {
      if (data.responses.openai) chatDiv.innerHTML += `<div style='color:#004;'>OpenAI: ${data.responses.openai}</div>`;
      if (data.responses.ollama) chatDiv.innerHTML += `<div style='color:#080;'>Ollama: ${data.responses.ollama}</div>`;
    } else {
      chatDiv.innerHTML += `<div style='color:red;'>Error: ${data.error || 'Unknown error'}</div>`;
    }
    chatDiv.scrollTop = chatDiv.scrollHeight;
    loadHistory();
  };
})();
