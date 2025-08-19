// app.js
require('dotenv').config();

const express           = require('express');
const http              = require('http');
const axios             = require('axios');
const fs                = require('fs');
const path              = require('path');
const { v4: uuidv4 }    = require('uuid');
const multer            = require('multer');
const session           = require('express-session');
const cors              = require('cors');

// Import utilities
const ThreatAnalyzer      = require('./threatAnalyzer');
const promptService       = require('./services/promptService');
const threatModelService  = require('./services/threatModelService');
const settingsService     = require('./services/settingsService');
const dbSettingsService   = require('./services/dbSettingsService');
const openaiUtil          = require('./utils/openai');
const ollamaUtil          = require('./utils/ollama');
const scheduler           = require('./utils/scheduler');
const { ingestThreatModel } = require('./services/ragIngestService');
const db                  = require('./database');

const assistantRoutes = require('./assistant/assistantRoutes');

// Log Ollama utility status
console.log('[APP] Ollama utility loaded. Initializing...');

const app   = express();
const port  = process.env.PORT || 3000;

// Permanently enable open CORS for all UI-to-backend calls (dev, test, prod)
// This allows all origins, all methods, all headers, and credentials.
// DO NOT RESTRICT unless explicitly required for prod security.


// Permanently enable open CORS for all UI-to-backend calls (dev, test, prod)
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
console.log('[CORS] CORS middleware and headers applied globally.');

// Configure middleware first (order matters)
// Parse JSON request bodies
app.use(express.json({ limit: '50mb' }));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from /public at /public/*
app.use('/public', express.static(path.join(__dirname, 'public')));

// Now mount route handlers after middleware is configured
// AI Assistant
app.use('/assistant', assistantRoutes);

// Import routes
const threatModelsMergeRoute = require('./routes/threat-models-merge');

// Mount route
app.use('/', threatModelsMergeRoute);

// Global error handler for debugging uncaught errors
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR HANDLER]', err.stack || err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error', stack: err.stack });
});

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally exit the process if you want to be strict about unhandled rejections
  // process.exit(1);
});

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION] Uncaught Exception:', error);
  // Don't exit immediately, but log the error
  // process.exit(1);
});

// CORS
// app.use(cors({ origin: 'https://tmodeling.onrender.com', credentials: true })); // Removed to allow open CORS

// Body parsing (for HTML forms and JSON, like curl and browser forms)
app.use(express.urlencoded({ extended: false, limit: '10mb' })); // Handles application/x-www-form-urlencoded
app.use(express.json({ limit: '10mb' })); // Handles application/json

// File uploads (unused here, but needed for other forms)
const upload = multer({ storage: multer.memoryStorage() });

// View engine & static files
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Register Ollama settings route early to avoid being shadowed
app.use('/settings/ollama', require('./routes/settings_ollama'));

// Session (in-memory for dev)
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: true,
  name: 'tmodel.sid',
  cookie: { secure: false, httpOnly: true, maxAge: 86400000, sameSite: 'lax' }
}));

// Dev‐only auth bypass
function ensureAuthenticated(req, res, next) {
  req.session.user = { username: 'demo' };
  next();
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const pool = app.locals.dbPool;
    const { rows } = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'UP', db: rows[0].ok === 1 ? 'UP' : 'DOWN', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'DOWN', db: 'DOWN', error: err.message });
  }
});

// Register /generate-more endpoint
app.use('/', require('./genmore'));

// /ask endpoint
app.post('/ask', ensureAuthenticated, async (req, res) => {
  try {
    console.log('==== /ask endpoint ====', req.body);
    const requestId = uuidv4();
    req.session.llmRequestId = requestId;
    const addEvent = (type, data) => { /* no-op or event store */ };

    let { subject, llmProvider, model, selectedPromptId, useEnhancedPrompt } = req.body;
    subject = subject?.toString() || '';

    // FALLBACK: read provider from DB
    if (!llmProvider) {
      llmProvider = (await settingsService.getSetting('settings:llm:provider', 'openai', true))
                      .toString()
                      .toLowerCase();
    }
    console.log('Resolved LLM provider:', llmProvider);

    // FALLBACK: read model from DB
    if (!model) {
      const key = llmProvider === 'ollama'
                  ? 'settings:api:ollama:model'
                  : 'settings:api:openai:model';
      const def = llmProvider === 'ollama' ? 'llama4:latest' : 'gpt-4';
      model = await settingsService.getSetting(key, def, true);
    }
    console.log('Resolved model:', model);

    // 1. Retrieve the selected prompt template from DB
    let promptTemplate = '';
    if (selectedPromptId) {
      const promptRecord = await require('./services/promptService').getPromptById(selectedPromptId);
      promptTemplate = promptRecord?.prompt_text || '';
      console.log('Loaded prompt template:', promptTemplate);
    } else {
      promptTemplate = 'Analyze the following system: SUBJECT.';
      console.log('No prompt template selected, using fallback:', promptTemplate);
    }

    // 2. Replace SUBJECT placeholder with submitted subject
    const composedPrompt = promptTemplate.replace(/\{\{\s*SUBJECT\s*\}\}|SUBJECT/g, subject);
    console.log('Composed prompt (pre-RAG) for LLM:', composedPrompt);

    // 2b. RAG retrieval: fetch top-K relevant chunks for subject and prepend as CONTEXT
    let finalPrompt = composedPrompt;
    try {
      const embeddingModel = await settingsService.getSetting('rag.embedding_model', 'text-embedding-3-small');
      const topK = Math.max(1, Math.min(Number(await settingsService.getSetting('rag.top_k', 8)), 50));
      const cutoff = Number(await settingsService.getSetting('rag.retrieval_distance_cutoff', 0.35));

      await openaiUtil.refreshClient();
      const embStart = Date.now();
      const embResp = await openaiUtil.openai.embeddings.create({ model: embeddingModel, input: subject || composedPrompt });
      const queryEmbedding = embResp.data?.[0]?.embedding;
      if (Array.isArray(queryEmbedding) && queryEmbedding.length > 0) {
        console.log('[RAG] Computed subject embedding', { ms: Date.now() - embStart, dim: queryEmbedding.length });
        const sqlVector = '[' + queryEmbedding.join(',') + ']';
        const sql = `
          WITH q AS (SELECT $1::vector AS query_embedding)
          SELECT id, record_id, threat_title, content, metadata,
                 (embedding <=> (SELECT query_embedding FROM q)) AS distance
            FROM threat_model.rag_chunks
           WHERE section = 'threat'
           ORDER BY embedding <=> (SELECT query_embedding FROM q)
           LIMIT $2;
        `;
        const qStart = Date.now();
        const rows = await db.query(sql, [sqlVector, topK * 4]); // overfetch for post-filter
        console.log('[RAG] Vector search done', { ms: Date.now() - qStart, rows: rows.rows.length, cutoff, topK });

        const filtered = rows.rows
          .map(r => ({
            id: r.id,
            title: r.threat_title || 'Untitled',
            content: r.content || '',
            metadata: r.metadata || {},
            distance: Number(r.distance)
          }))
          .filter(r => isFinite(r.distance) && r.distance <= cutoff)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, topK);

        if (filtered.length > 0) {
          const clamp = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : (s || ''));
          const ctxLines = filtered.map((m, idx) => {
            const excerpt = clamp(m.content.replace(/\s+/g, ' ').trim(), 800);
            return `[${idx + 1}] Title: ${clamp(m.title, 120)}\n${excerpt}`;
          });
          const contextBlock = [
            'SYSTEM:',
            'Use the following context snippets to ground your analysis. Cite with [#] when applicable. Do not fabricate context.',
            '',
            'CONTEXT (RAG excerpts):',
            ...ctxLines,
            '',
          ].join('\n');
          finalPrompt = contextBlock + '\n' + composedPrompt + '\n\nAdd citations like [1], [2] to indicate which context items informed each threat.';
        } else {
          console.log('[RAG] No matches under cutoff; proceeding without CONTEXT');
        }
      } else {
        console.warn('[RAG] Empty embedding for subject; skipping retrieval');
      }
    } catch (ragErr) {
      console.error('[RAG] Retrieval error; proceeding without CONTEXT:', ragErr.message);
    }
    console.log('Final prompt (post-RAG injection) for LLM:', (finalPrompt || composedPrompt));

    // 3. Call the correct LLM provider
    let llmResponseText = '';
    try {
      // Resolve max tokens from settings with sensible defaults and support 'auto' (omit max_tokens)
      let maxTokens = 2000;
      let maxTokensMode = 'numeric';
      try {
        if (llmProvider === 'ollama') {
          const raw = await settingsService.getSetting('settings:api:ollama:max_tokens_create', '2000', true);
          const valStr = (raw ?? '').toString().trim().toLowerCase();
          if (valStr === 'auto') {
            maxTokens = Number.NaN; // signal to omit downstream
            maxTokensMode = 'auto';
          } else {
            const n = Number(raw);
            maxTokens = Math.max(256, Math.min(Number.isFinite(n) ? n : 2000, 4096));
          }
        } else {
          const raw = await settingsService.getSetting('settings:api:openai:max_tokens_create', '2000', true);
          const valStr = (raw ?? '').toString().trim().toLowerCase();
          if (valStr === 'auto') {
            maxTokens = Number.NaN; // signal to omit downstream
            maxTokensMode = 'auto';
          } else {
            const n = Number(raw);
            maxTokens = Math.max(256, Math.min(Number.isFinite(n) ? n : 2000, 4096));
          }
        }
      } catch (e) {
        console.warn('[ASK] Failed to load max_tokens setting, using default 2000:', e.message);
        maxTokens = 2000;
      }
      console.log(`[ASK] max_tokens mode=${maxTokensMode}${maxTokensMode==='numeric' ? ` value=${maxTokens}` : ' (omitted)'} provider=${llmProvider} model=${model}`);

      if (llmProvider === 'ollama') {
        const ollamaUtil = require('./utils/ollama');
        const ollamaResp = await ollamaUtil.getCompletion(finalPrompt, model, maxTokens);
        llmResponseText = ollamaResp || '';
        console.log('[ASK] Ollama response length:', llmResponseText.length);
        console.log('Ollama LLM response (preview):', llmResponseText.slice(0, 200));
      } else {
        const openaiUtil = require('./utils/openai');
        const openaiResp = await openaiUtil.getCompletion(finalPrompt, model, maxTokens);
        llmResponseText = openaiResp?.choices?.[0]?.message?.content || openaiResp?.choices?.[0]?.text || '';
        console.log('[ASK] OpenAI response length:', llmResponseText.length);
        console.log('OpenAI LLM response (preview):', llmResponseText.slice(0, 200));
      }
    } catch (llmErr) {
      console.error('Error calling LLM provider:', llmErr);
      llmResponseText = '[ERROR] Failed to get response from LLM provider.';
    }

    // 4. Compose threat model fields
    const threatModelData = {
      title: subject ? `Threat Model for ${subject}` : 'Untitled Threat Model',
      description: subject,
      subjectText: subject,
      response: llmResponseText,
      model,
      username: req.session.user?.username || 'demo',
      llmProvider, // Ensure this is saved to DB
      // projectId: (add if available from req.body)
    };
    // 5. Save to DB
    const created = await threatModelService.createThreatModel(threatModelData);
    console.log('Threat model created:', created.id);
    // Non-blocking: enqueue RAG ingestion for this model (cleanup old chunks)
    try {
      setImmediate(async () => {
        try {
          console.log('[RAG] Starting per-model ingestion for', created.id);
          const resIngest = await ingestThreatModel(created.id, { cleanup: true });
          console.log('[RAG] Ingestion complete', resIngest);
        } catch (e) {
          console.error('[RAG] Ingestion error for', created.id, e);
        }
      });
    } catch (e) {
      console.error('[RAG] Failed to schedule ingestion task', e);
    }
    return res.json({ id: created.id });
  } catch (err) {
    console.error('Error generating threat model:', err);
    res.status(500).json({ error: 'Error generating threat model', details: err.message });
  }
});

// Mount your routes
app.use('/settings-minimal-test', require('./routes/settings_minimal_test'));
app.use('/llm-test-raw', require('./routes/llm-test-raw'));
// app.use('/dbsettings', require('./routes/dbsettings')); // Archived/removed
app.use('/projects', require('./routes/projects'));
app.use('/llm-usage', require('./routes/llm-usage'));
app.use('/', ensureAuthenticated, require('./routes/main'));
app.use('/test-llm-provider', require('./routes/settings'));
app.use('/settings/llm-provider', require('./routes/settings_llm_provider'));
app.use('/settings/openai', require('./routes/settings_openai'));
app.use('/settings/ollama', require('./routes/settings_ollama'));
app.use('/settings/rapid7', require('./routes/settings_rapid7'));
app.use('/settings/jira', require('./routes/settings_jira'));
app.use('/settings/confluence', require('./routes/settings_confluence'));
app.use('/settings/auditboard', require('./routes/settings_auditboard'));
app.use('/settings/lucid', require('./routes/settings_lucid'));
app.use('/settings/llmprovider', require('./routes/settings_llm_provider'));
app.use('/settings', require('./routes/settings'));
// app.use('/api-settings', (req, res) => res.redirect('/settings')); // No longer needed
// API Routes
app.use('/api', require('./routes/api/index')); // This will handle all /api/* routes
app.use('/api/models', require('./routes/api/models'));
app.use('/api/rapid7-test', require('./routes/api/rapid7-test'));
app.use('/api/reference-architecture',
  require('./src/server/routes/referenceArchitecture')({ pool: app.locals.dbPool })
);
app.use('/api/reports', require('./routes/api/reports'));
app.use('/api/project-mapper', require('./routes/api/projectMapper')); // Project ID mapper for UUID-to-int conversion

// Application Routes
app.use('/components', require('./routes/components'));
app.use('/safeguards', require('./routes/safeguards'));
app.use('/models', require('./routes/models'));
app.use('/vulnerability-dashboard', require('./routes/vulnerability-dashboard'));
app.use('/api-explorer', require('./routes/api-explorer'));
app.use('/rapid7-bypass', require('./routes/rapid7-bypass'));
app.use('/enterprise-architecture', require('./routes/enterpriseArchitectureController'));

// Mount the threat model merge UI route
app.use('/', require('./routes/threatModelMerge'));

// Mount project detail controller for /projects/:id and related routes
app.use('/', require('./routes/projectDetailController'));

// Reporting Routes
app.use('/reporting', require('./routes/reporting'));

// Reports App Routes
app.use('/reports', require('./routes/reports'));

// ROUTE DUMP: Print all registered routes at startup
if (process.env.NODE_ENV !== 'production') {
  console.log('=== REGISTERED EXPRESS ROUTES ===');
  app._router.stack
    .filter(r => r.route)
    .forEach(r => {
      const methods = Object.keys(r.route.methods).join(',').toUpperCase();
      console.log(`${methods} ${r.route.path}`);
    });
  console.log('=== END ROUTE DUMP ===');
}

// Bootstrap everything and then start listening
(async () => {
  try {
    console.log('='.repeat(80));
    console.log('[APP] Starting application initialization...');
    
    // 1) (Table creation/seed removed; handled externally)
    console.log('[APP] Skipping table creation (handled externally)');

    // 2) Connect to Postgres
    console.log('[APP] Connecting to PostgreSQL...');
    const pool = await dbSettingsService.getConnection();
    app.locals.dbPool = pool;
    console.log(`[APP] Connected to PostgreSQL: ${pool.options.host}:${pool.options.port}/${pool.options.database}`);

    // 3) Initialize threat analyzer
    console.log('[APP] Initializing Threat Analyzer...');
    app.locals.threatAnalyzer = new ThreatAnalyzer();
    console.log('[APP] Threat Analyzer initialized');

    // 4) Initialize LLM client (provider detection skipped; default to OpenAI for now)
    console.log('[APP] Initializing LLM client (defaulting to OpenAI)...');
    console.log('[APP] Current LLM provider: openai (defaulted, detection skipped)');
    try {
      await openaiUtil.refreshClient();
      console.log('[APP] OpenAI client initialized successfully');
    } catch (error) {
      console.error('[APP] Failed to initialize OpenAI client:', error);
      process.exit(1);
    }

    // 4b) Validate pgvector dimension parity at startup (fail fast on mismatch)
    try {
      const embeddingModel = await settingsService.getSetting('rag.embedding_model', 'text-embedding-3-small');
      const probeText = 'dim-check';
      const embResp = await openaiUtil.openai.embeddings.create({ model: embeddingModel, input: probeText });
      const appDim = embResp?.data?.[0]?.embedding?.length || null;
      if (!appDim) throw new Error('Could not determine embedding dimension from provider');

      const dimSql = `
        SELECT regexp_replace(format_type(a.atttypid, a.atttypmod), '^.*\\((\\d+)\\)$', '\\1')::int AS dim
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'threat_model'
           AND c.relname = 'rag_chunks'
           AND a.attname = 'embedding'
      `;
      const { rows: dimRows } = await app.locals.dbPool.query(dimSql);
      const dbDim = dimRows?.[0]?.dim || null;
      if (!dbDim) throw new Error('Could not read DB vector dimension for threat_model.rag_chunks.embedding');

      console.log(`[INIT] Vector dimension check: app=${appDim} db=${dbDim} model=${embeddingModel}`);
      if (appDim !== dbDim) {
        console.error('[INIT][FATAL] Embedding dimension mismatch between app and DB', { appDim, dbDim, embeddingModel });
        console.error('Please update DB schema and settings to match. Exiting.');
        process.exit(1);
      }
    } catch (e) {
      console.error('[INIT] Error performing vector dimension parity check:', e);
      process.exit(1);
    }

        // 5) Schedule periodic checks
    console.log('[INIT] Step 1/4: Scheduling API checks...');
    try {
      scheduler.scheduleApiChecks(60);
      console.log('[INIT] ✓ API checks scheduled');
    } catch (error) {
      console.error('[INIT] ✗ Failed to schedule API checks:', error);
      process.exit(1);
    }

    // Initialize Ollama utility
    console.log('[INIT] Step 2/4: Initializing Ollama utility...');
    try {
      await ollamaUtil.init();
      console.log('[INIT] ✓ Ollama utility initialized successfully');
    } catch (error) {
      console.error('[INIT] ✗ Failed to initialize Ollama utility:', error);
      process.exit(1);
    }
    
    // Add a small delay to ensure all async operations complete
    console.log('[INIT] Step 3/4: Finalizing initialization...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('[INIT] ✓ Initialization complete');

    // Start the server
    console.log('='.repeat(80));
    console.log('[APP] ===== REACHED SERVER STARTUP =====');
    
    // Define ports to try in sequence if the default port is in use
    const DEFAULT_PORT = process.env.PORT || 3000;
    const ALTERNATIVE_PORTS = [3001, 3002, 3003, 3004, 3005];
    let currentPortIndex = -1; // Start with default port (index -1 means use DEFAULT_PORT)
    let server;
    
    function startServer(port) {
      console.log(`[APP] Attempting to start server on port ${port}...`);
      console.log(`[APP] Process ID: ${process.pid}`);
      console.log('='.repeat(80));
      
      server = http.createServer(app);
      console.log('[APP] Server instance created, setting up event listeners...');
      
      // Handle server-level errors
      server.on('error', (error) => {
        console.error('[APP] Server error event:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        
        if (error.code === 'EADDRINUSE') {
          console.error(`[APP] Port ${port} is already in use`);
          // Try the next port in the list
          currentPortIndex++;
          if (currentPortIndex < ALTERNATIVE_PORTS.length) {
            const nextPort = ALTERNATIVE_PORTS[currentPortIndex];
            console.log(`[APP] Trying alternative port: ${nextPort}`);
            startServer(nextPort);
          } else {
            console.error('[APP] All alternative ports are in use. Exiting.');
            process.exit(1);
          }
        } else if (error.code === 'EACCES') {
          console.error(`[APP] Permission denied - cannot bind to port ${port}`);
          process.exit(1);
        } else if (error.code === 'EADDRNOTAVAIL') {
          console.error(`[APP] Address not available - cannot bind to port ${port}`);
          process.exit(1);
        } else {
          // Handle other errors
          console.error('[APP] Fatal server error:', error);
          process.exit(1);
        }
      });
      
      // Log when server starts listening
      server.on('listening', () => {
        try {
          const address = server.address();
          console.log('='.repeat(80));
          console.log(`[APP] Server is running!`);
          console.log(`[APP] Address: ${JSON.stringify(address, null, 2)}`);
          console.log(`[APP] Access the application at: http://${address.address === '0.0.0.0' ? 'localhost' : address.address}:${address.port}`);
          console.log('='.repeat(80));
          console.log('[APP] Scheduled tasks are already configured');
          console.log(`[APP] Server is now listening on port ${address.port}`);
          console.log(`[APP] Server details:`, {
            address: address.address,
            family: address.family,
            port: address.port
          });
        } catch (err) {
          console.error('[APP] Error in listening handler:', err);
        }
      });
      
      // Start the server
      return server.listen(port, '0.0.0.0');
    }
    
    // Start the server with the default port
    startServer(DEFAULT_PORT);

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('[APP] SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('[APP] Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('[APP] SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('[APP] Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Failed to initialize application:', err);
    process.exit(1);
  }
})();
