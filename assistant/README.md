# Assistant AI Module

This module provides a persistent, unified AI chat assistant supporting both OpenAI and Ollama (local) providers, with Mirror Mode (dual responses) and contextual awareness toggle.

## Features
- Floating button on every page
- Modal chat UI
- Provider selection (OpenAI or Ollama)
- Mirror Mode (show responses from both)
- Contextual awareness toggle
- Chat history (stored in PostgreSQL)
- Fetches API keys from `api_key` table

## Integration
1. Mount `assistant/assistantRoutes.js` in your `app.js`:
   ```js
   const assistantRoutes = require('./assistant/assistantRoutes');
   app.use('/assistant', assistantRoutes);
   ```
2. Serve static assets from `/assistant`.
3. Include `<%- include('assistant/views/assistantModal') %>` in your main layout.
4. Ensure database tables exist (see below).

## Database Schema
```sql
CREATE TABLE assistant_chat_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  session_id TEXT,
  provider TEXT,
  model TEXT,
  user_message TEXT,
  ai_response TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE assistant_settings (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  session_id TEXT,
  mirror_mode BOOLEAN,
  context_enabled BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage
- Click the "AI Assistant" button to open the chat modal.
- Select provider/model, toggle Mirror Mode/context as needed.
- Messages and settings are stored per session/user.

---

**This module is fully self-contained and does not depend on other app logic except for mounting and DB access.**
