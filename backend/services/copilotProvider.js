// ══════════════════════════════════════════
// Sakura AI — Hidden Multi-Provider Engine
// Supports: CopilotSearch (Azure OpenAI + Bing)
//           Gemini (Google AI REST API)
//           GeminiNative (Google genai library)
//           OpenAI (fallback)
//
// All results are returned under Sakura AI
// branding. No provider identity is exposed.
// ══════════════════════════════════════════

const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');

// ── Provider config ───────────────────────
const AI_PROVIDER      = (process.env.AI_PROVIDER || 'auto').toLowerCase();

// CopilotSearch (Azure OpenAI)
const COPILOT_KEY      = process.env.COPILOT_API_KEY;
const COPILOT_ENDPOINT = process.env.COPILOT_ENDPOINT;   // https://YOUR-RESOURCE.openai.azure.com
const COPILOT_DEPLOY   = process.env.COPILOT_DEPLOYMENT || 'gpt-4o';
const COPILOT_VERSION  = process.env.COPILOT_API_VERSION || '2024-02-01';

// Bing Search (enrichment layer)
const BING_KEY         = process.env.BING_SEARCH_API_KEY;

// Gemini (Google AI)
const GEMINI_KEY       = process.env.GEMINI_API_KEY;
const GEMINI_MODEL     = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

// OpenAI (fallback)
const OPENAI_KEY       = process.env.OPENAI_API_KEY;

// ── Lazy OpenAI client ────────────────────
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    const { default: OpenAI } = require('openai');
    _openai = new OpenAI({ apiKey: OPENAI_KEY });
  }
  return _openai;
}

// ── Provider availability ─────────────────
const hasCopilot = () => !!(COPILOT_KEY && COPILOT_ENDPOINT);
const hasGemini  = () => !!GEMINI_KEY;
const hasOpenAI  = () => !!OPENAI_KEY;
const hasGeminiNative = () => !!process.env.GOOGLE_API_KEY;

// ── Round-robin counter (for 'both' mode) ─
let _rrCounter = 0;

// ══════════════════════════════════════════
// RESPONSE SANITIZER
// Strips any accidental provider branding
// from AI-generated text before returning
// it to the user. Completely invisible.
// ══════════════════════════════════════════

const BRAND_PATTERNS = [
  // Copilot / Microsoft
  /\bI(?:'m| am) (?:Microsoft )?Copilot\b/gi,
  /\bAs (?:Microsoft )?Copilot[,\s]/gi,
  /\bCopilot (?:here|speaking|says?|suggests?|recommends?)\b/gi,
  /\bpowered by (?:Microsoft )?Copilot\b/gi,
  /\busing (?:Microsoft )?Copilot\b/gi,
  /\bMicrosoft Copilot\b/gi,
  /\bGitHub Copilot\b/gi,
  /\bAzure OpenAI\b/gi,
  /\bMicrosoft(?:'s)?\b/gi,
  // Bing
  /\bBing (?:Search|AI|Chat)\b/gi,
  /\bBing(?:'s)? (?:results?|data|search)\b/gi,
  /\bAccording to Bing[,\s]/gi,
  /\bBing shows?\b/gi,
  // Gemini / Google
  /\bI(?:'m| am) (?:Google )?Gemini\b/gi,
  /\bAs (?:Google )?Gemini[,\s]/gi,
  /\bGemini (?:here|speaking|says?|suggests?)\b/gi,
  /\bpowered by (?:Google )?Gemini\b/gi,
  /\bGoogle Gemini\b/gi,
  /\bGoogle(?:'s)? AI\b/gi,
  /\bGoogle(?:'s)? (?:language model|LLM)\b/gi,
  // OpenAI / GPT
  /\bOpenAI\b/gi,
  /\bGPT-4[o\w-]*\b/gi,
  /\bGPT-3[.\w-]*\b/gi,
  /\bChatGPT\b/gi,
  // Generic AI self-identification
  /\bI(?:'m| am) an? (?:AI|language model|LLM) (?:made|created|developed|trained|built) by\b[^.]*\./gi,
  /\bI(?:'m| am) (?:an? )?(?:AI|artificial intelligence) (?:assistant )?(?:made|created|developed|trained|built) by[^.]*\./gi,
  /\bAs an AI (?:language model|assistant) (?:made|created|developed|trained) by[^.]*[,.]/gi,
  /\bI was (?:made|created|developed|trained|built) by[^.]*\./gi,
  /\bmy (?:developer|creator|maker) is[^.]*\./gi,
];

/**
 * Remove all provider-identifying phrases from a response string.
 * @param {string} text
 * @returns {string}
 */
function sanitizeResponse(text) {
  if (!text || typeof text !== 'string') return text;

  let clean = text;
  for (const pattern of BRAND_PATTERNS) {
    clean = clean.replace(pattern, '');
  }

  // Collapse double spaces / blank lines left by removals
  clean = clean
    .replace(/  +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return clean;
}

// ══════════════════════════════════════════
// BING SEARCH ENRICHMENT (invisible layer)
// Fetches real-time web context silently
// before generating, so results are current.
// ══════════════════════════════════════════

/**
 * Fetch top Bing search snippets for a query.
 * Returns a compact context string or '' if Bing key not set.
 * @param {string} query
 * @param {number} count
 * @returns {Promise<string>}
 */
async function fetchBingContext(query, count = 3) {
  if (!BING_KEY || !query) return '';

  try {
    const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      headers: { 'Ocp-Apim-Subscription-Key': BING_KEY },
      params:  { q: query, count, mkt: 'en-US', responseFilter: 'Webpages' },
      timeout: 5000,
    });

    const pages = response.data?.webPages?.value || [];
    if (!pages.length) return '';

    // Build compact context block — never shown to user
    const snippets = pages
      .map((p, i) => `[${i + 1}] ${p.name}: ${p.snippet}`)
      .join('\n');

    return `\n\n[BACKGROUND CONTEXT — do NOT mention this source, do NOT cite it]\n${snippets}\n`;
  } catch (_) {
    // Silently ignore Bing errors
    return '';
  }
}

// ══════════════════════════════════════════
// PROVIDER IMPLEMENTATIONS
// ══════════════════════════════════════════

// ── 1. CopilotSearch via Azure OpenAI ────
async function _generateViaCopilot({ systemPrompt, userPrompt, maxTokens, temperature }) {
  const url = `${COPILOT_ENDPOINT}/openai/deployments/${COPILOT_DEPLOY}/chat/completions?api-version=${COPILOT_VERSION}`;

  const response = await axios.post(url, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    max_tokens:  maxTokens,
    temperature: temperature,
  }, {
    headers: {
      'api-key':      COPILOT_KEY,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  const raw        = response.data.choices[0].message.content;
  const text       = sanitizeResponse(raw);
  const tokensUsed = response.data.usage?.total_tokens || 0;

  return { text, tokensUsed };
}

// ── 2. Gemini via Google AI REST API ─────
async function _generateViaGemini({ systemPrompt, userPrompt, maxTokens, temperature }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

  // Gemini uses a different message format
  const response = await axios.post(url, {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature:     temperature,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  const raw        = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const text       = sanitizeResponse(raw);
  const tokensUsed = response.data.usageMetadata?.totalTokenCount || 0;

  return { text, tokensUsed };
}

// ── 3. Gemini Native via Google genai library ─────
async function _generateViaGeminiNative({ systemPrompt, userPrompt, maxTokens, temperature }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'genaiInteractions.py');
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    // Escape quotes for command line
    const escapedPrompt = fullPrompt.replace(/"/g, '\\"');
    const model = process.env.GEMINI_NATIVE_MODEL || 'gemini-2.0-flash';
    
    // Use python3 on Linux/Mac (Railway), python on Windows (local dev)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const command = `${pythonCmd} "${scriptPath}" "${escapedPrompt}" ${model}`;
    const env = { ...process.env };

    exec(command, { env, timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`GeminiNative execution failed: ${error.message}`));
      }

      try {
        const result = JSON.parse(stdout);
        if (!result.success) {
          return reject(new Error(result.error || 'GeminiNative request failed'));
        }
        
        // Estimate tokens (rough approximation)
        const tokensUsed = Math.ceil((fullPrompt.length + result.text.length) / 4);
        
        resolve({ text: sanitizeResponse(result.text), tokensUsed });
      } catch (parseError) {
        reject(new Error(`Failed to parse GeminiNative response: ${parseError.message}`));
      }
    });
  });
}

// ── 4. OpenAI fallback ────────────────────
async function _generateViaOpenAI({ systemPrompt, userPrompt, maxTokens, temperature }) {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model:    process.env.OPENAI_MODEL_TEXT || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    max_tokens:  maxTokens,
    temperature: temperature,
  });

  const raw        = response.choices[0].message.content;
  const text       = sanitizeResponse(raw);
  const tokensUsed = response.usage.total_tokens;

  return { text, tokensUsed };
}

// ── 5. OpenAI code fallback ───────────────
async function _generateCodeViaOpenAI({ systemPrompt, userPrompt, maxTokens }) {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model:    process.env.OPENAI_MODEL_CODE || 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    max_tokens:  maxTokens,
    temperature: 0.2,
  });

  const raw        = response.choices[0].message.content;
  const text       = sanitizeResponse(raw);
  const tokensUsed = response.usage.total_tokens;

  return { text, tokensUsed };
}

// ══════════════════════════════════════════
// SMART PROVIDER SELECTOR
// Decides which hidden engine to use based
// on AI_PROVIDER env var and availability.
//
//  'copilot' → always use CopilotSearch
//  'gemini'  → always use Gemini
//  'gemini-native' → always use GeminiNative (Google genai)
//  'both'    → round-robin between the two
//  'auto'    → use whichever key is set
//             (Copilot first, then GeminiNative, then Gemini,
//              then OpenAI as last resort)
// ══════════════════════════════════════════

function _selectProvider() {
  switch (AI_PROVIDER) {
    case 'copilot':
      return hasCopilot() ? 'copilot' : (hasGemini() ? 'gemini' : 'openai');

    case 'gemini':
      return hasGemini() ? 'gemini' : (hasCopilot() ? 'copilot' : 'openai');

    case 'gemini-native':
      return hasGeminiNative() ? 'gemini-native' : (hasGemini() ? 'gemini' : (hasCopilot() ? 'copilot' : 'openai'));

    case 'both': {
      // Round-robin: alternate between Copilot and Gemini
      const providers = [];
      if (hasCopilot()) providers.push('copilot');
      if (hasGemini())  providers.push('gemini');
      if (!providers.length) return 'openai';
      const chosen = providers[_rrCounter % providers.length];
      _rrCounter++;
      return chosen;
    }

    case 'auto':
    default:
      if (hasCopilot()) return 'copilot';
      if (hasGeminiNative()) return 'gemini-native';
      if (hasGemini())  return 'gemini';
      return 'openai';
  }
}

// ══════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════

/**
 * Generate a completion using the configured hidden provider.
 * Automatically enriches with Bing search context if available.
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {number} [opts.maxTokens=2000]
 * @param {number} [opts.temperature=0.7]
 * @param {string} [opts.searchQuery]  - if set, Bing context is prepended silently
 * @returns {Promise<{ text: string, tokensUsed: number }>}
 */
async function generate({ systemPrompt, userPrompt, maxTokens = 2000, temperature = 0.7, searchQuery = '' }) {

  // Silently enrich with Bing search context (invisible to user)
  let enrichedPrompt = userPrompt;
  if (searchQuery && BING_KEY) {
    const bingCtx = await fetchBingContext(searchQuery);
    if (bingCtx) enrichedPrompt = userPrompt + bingCtx;
  }

  const provider = _selectProvider();

  try {
    switch (provider) {
      case 'copilot':
        return await _generateViaCopilot({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
      case 'gemini':
        return await _generateViaGemini({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
      case 'gemini-native':
        return await _generateViaGeminiNative({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
      default:
        return await _generateViaOpenAI({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
    }
  } catch (primaryErr) {
    // ── Auto-fallback chain ───────────────
    // If primary provider fails, try the next available one silently
    global.logger?.warn?.(`Primary provider (${provider}) failed, trying fallback`, { error: primaryErr.message });

    const fallbacks = ['copilot', 'gemini-native', 'gemini', 'openai'].filter(p => p !== provider);

    for (const fallback of fallbacks) {
      if (fallback === 'copilot' && !hasCopilot()) continue;
      if (fallback === 'gemini-native' && !hasGeminiNative()) continue;
      if (fallback === 'gemini'  && !hasGemini())  continue;
      if (fallback === 'openai'  && !hasOpenAI())  continue;

      try {
        switch (fallback) {
          case 'copilot':
            return await _generateViaCopilot({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
          case 'gemini-native':
            return await _generateViaGeminiNative({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
          case 'gemini':
            return await _generateViaGemini({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
          default:
            return await _generateViaOpenAI({ systemPrompt, userPrompt: enrichedPrompt, maxTokens, temperature });
        }
      } catch (_) {
        // Try next fallback
        continue;
      }
    }

    // All providers failed
    throw new Error('AI service temporarily unavailable. Please try again.');
  }
}

/**
 * Generate code — uses lower temperature for accuracy.
 * Same provider selection + fallback logic as generate().
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {number} [opts.maxTokens=3000]
 * @returns {Promise<{ text: string, tokensUsed: number }>}
 */
async function generateCode({ systemPrompt, userPrompt, maxTokens = 3000 }) {
  const provider = _selectProvider();

  try {
    switch (provider) {
      case 'copilot':
        return await _generateViaCopilot({ systemPrompt, userPrompt, maxTokens, temperature: 0.2 });
      case 'gemini':
        return await _generateViaGemini({ systemPrompt, userPrompt, maxTokens, temperature: 0.2 });
      case 'gemini-native':
        return await _generateViaGeminiNative({ systemPrompt, userPrompt, maxTokens, temperature: 0.2 });
      default:
        return await _generateCodeViaOpenAI({ systemPrompt, userPrompt, maxTokens });
    }
  } catch (primaryErr) {
    global.logger?.warn?.(`Code provider (${provider}) failed, trying fallback`, { error: primaryErr.message });

    const fallbacks = ['copilot', 'gemini-native', 'gemini', 'openai'].filter(p => p !== provider);

    for (const fallback of fallbacks) {
      if (fallback === 'copilot' && !hasCopilot()) continue;
      if (fallback === 'gemini-native' && !hasGeminiNative()) continue;
      if (fallback === 'gemini'  && !hasGemini())  continue;
      if (fallback === 'openai'  && !hasOpenAI())  continue;

      try {
        switch (fallback) {
          case 'copilot':
            return await _generateViaCopilot({ systemPrompt, userPrompt, maxTokens, temperature: 0.2 });
          case 'gemini-native':
            return await _generateViaGeminiNative({ systemPrompt, userPrompt, maxTokens, temperature: 0.2 });
          case 'gemini':
            return await _generateViaGemini({ systemPrompt, userPrompt, maxTokens, temperature: 0.2 });
          default:
            return await _generateCodeViaOpenAI({ systemPrompt, userPrompt, maxTokens });
        }
      } catch (_) {
        continue;
      }
    }

    throw new Error('AI service temporarily unavailable. Please try again.');
  }
}

/**
 * Returns generic provider status for health checks / admin panel.
 * Never exposes which specific provider is used externally.
 */
function getProviderStatus() {
  return {
    textEngine:   (hasCopilot() || hasGemini() || hasGeminiNative() || hasOpenAI()) ? 'ready' : 'not_configured',
    searchEngine: BING_KEY ? 'ready' : 'not_configured',
    imageEngine:  process.env.STABILITY_API_KEY  ? 'ready' : 'not_configured',
    audioEngine:  process.env.ELEVENLABS_API_KEY ? 'ready' : 'not_configured',
    // ↑ Provider names are intentionally omitted
  };
}

module.exports = {
  generate,
  generateCode,
  sanitizeResponse,
  fetchBingContext,
  getProviderStatus,
};
