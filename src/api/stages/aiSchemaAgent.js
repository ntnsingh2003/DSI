/**
 * Stage 5: AI Schema Agent
 * Sends the GeminiPayload to Google Gemini and returns a RawAISchema.
 *
 * Model fallback chain: gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-flash
 * Per-model retry policy: 3 attempts with exponential backoff (2s → 5s → 10s)
 * Cache: localStorage keyed by fileName + rowCount + colCount
 *
 * IMPORTANT: If ALL models and retries fail, this throws — no local fallback.
 * The pipeline then surfaces a clear error to the user.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let _genAI = null;

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY_MISSING: Please add VITE_GEMINI_API_KEY=your_key to your .env file in the project root.'
    );
  }
  if (!_genAI) _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

// ── Cache Utilities ─────────────────────────────────────────────────────────
function getCacheKey(metadata) {
  return `dsi_ai_schema_v2__${metadata.fileName}__${metadata.rowCount}__${metadata.colCount}`;
}

function readCache(metadata) {
  try {
    const raw = localStorage.getItem(getCacheKey(metadata));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(metadata, schema) {
  try {
    localStorage.setItem(getCacheKey(metadata), JSON.stringify({ ...schema, _cachedAt: Date.now() }));
  } catch {
    // localStorage quota exceeded — silent, cache is a nice-to-have
  }
}

// ── JSON Recovery Parser ────────────────────────────────────────────────────
function parseAIResponse(text) {
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain a valid JSON object.');
  }

  let candidate = clean.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // Attempt auto-repair: trailing commas, unquoted keys
    candidate = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    return JSON.parse(candidate);
  }
}

// ── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are DSI Enterprise Schema Intelligence AI — a world-class business intelligence schema analyst.

CRITICAL RULES:
1. Return ONLY a valid JSON object. No markdown, no explanation, no code fences.
2. Every value in "columnRoles" MUST be an EXACT column name from columnProfiles[].name, or null.
3. Every column reference in "kpiList[].column" and "chartList[].xAxis/yAxis/dimension/metric" MUST be an EXACT column name or null.
4. NEVER invent column names. If unsure, use null.
5. The "kpiList" must contain 4 to 8 meaningful KPIs for this specific dataset.
6. The "chartList" must contain 2 to 5 charts appropriate for this dataset type.
7. The currency and currencySymbol should match the data (e.g. if amounts look like Indian rupees, use INR and ₹).

AVAILABLE COLUMN ROLES (map to exact column names or null):
date | metric | quantity | price | cost | profit | discount | product | customer |
employee | department | category | entity | city | state | country

KPI AGGREGATIONS: "sum" | "avg" | "count" | "max" | "min" | "count_distinct"
CHART TYPES: "area" | "bar" | "line" | "pie" | "scatter" | "radar"

Return ONLY this JSON structure (no extra text):
{
  "datasetType": string,
  "businessDomain": string,
  "confidence": number,
  "language": "en",
  "currency": string,
  "currencySymbol": string,
  "primaryKey": string|null,
  "columnRoles": {
    "date": string|null,
    "metric": string|null,
    "quantity": string|null,
    "price": string|null,
    "cost": string|null,
    "profit": string|null,
    "discount": string|null,
    "product": string|null,
    "customer": string|null,
    "employee": string|null,
    "department": string|null,
    "category": string|null,
    "entity": string|null,
    "city": string|null,
    "state": string|null,
    "country": string|null
  },
  "kpiList": [
    { "id": string, "label": string, "column": string|null, "aggregation": string, "prefix": string, "suffix": string, "description": string }
  ],
  "chartList": [
    { "id": string, "type": string, "title": string, "xAxis": string|null, "yAxis": string|null, "dimension": string|null, "metric": string|null, "groupBy": string|null }
  ],
  "filterColumns": [string],
  "drilldownPath": string,
  "anomalyRules": [
    { "type": "negative_metric"|"zscore_outlier"|"null_check", "column": string, "threshold": number|null }
  ],
  "relationships": [string],
  "summary": string,
  "insights": [string],
  "recommendations": [{"title": string, "desc": string}],
  "risks": [string],
  "opportunities": [string],
  "patterns": [string],
  "forecast": [string],
  "health": string,
  "strengths": [string],
  "weaknesses": [string],
  "conclusion": string
}`;

// ── Main Agent Function ─────────────────────────────────────────────────────
/**
 * @param {GeminiPayload} geminiPayload - Output of Stage 4
 * @param {Function} onProgress - (message: string) => void
 * @returns {Promise<RawAISchema>}
 * @throws {Error} if API key is missing, invalid, or all retries fail
 */
export async function runAISchemaAgent(geminiPayload, onProgress) {
  const { metadata } = geminiPayload;

  // 1. API key guard — fail fast, no silent local fallback
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error(
      'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY=your_api_key to your .env file.'
    );
  }

  // 2. Cache check
  onProgress?.('Checking schema cache...');
  const cached = readCache(metadata);
  if (cached) {
    onProgress?.('✓ Cached schema found — skipping AI call');
    return { ...cached, _fromCache: true };
  }

  const userPrompt = `Analyze this dataset and return the schema JSON:

${JSON.stringify(geminiPayload, null, 2)}`;

  const fullPrompt = `${SYSTEM_PROMPT}\n\nDataset to analyze:\n${userPrompt}`;

  // 3. Model fallback chain with per-model retry
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const retryDelays = [2000, 5000, 10000];
  let lastError = null;

  for (const modelName of models) {
    onProgress?.(`Contacting ${modelName}...`);

    for (let attempt = 0; attempt <= 2; attempt++) {
      if (attempt > 0) {
        const delay = retryDelays[attempt - 1];
        onProgress?.(`Retrying ${modelName} (attempt ${attempt + 1}/3) in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }

      try {
        const client = getClient();
        const model = client.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        });

        const text = result.response.text();
        if (!text?.trim()) throw new Error('Received empty response from model.');

        onProgress?.('Parsing AI schema response...');
        const schema = parseAIResponse(text);
        schema._model = modelName;
        schema._fromCache = false;

        writeCache(metadata, schema);
        onProgress?.(`Schema detected via ${modelName}: "${schema.datasetType}" (${schema.confidence}% confidence)`);
        return schema;

      } catch (err) {
        lastError = err;
        const msg = err?.message || '';

        // Fail fast on auth errors — no point retrying other models
        if (
          msg.includes('API key not valid') ||
          msg.includes('key is invalid') ||
          msg.includes('INVALID_ARGUMENT') ||
          msg.includes('GEMINI_API_KEY_MISSING')
        ) {
          throw new Error(
            'Invalid Gemini API key. Please verify VITE_GEMINI_API_KEY in your .env file.'
          );
        }

        console.warn(`[AISchemaAgent] ${modelName} attempt ${attempt + 1} failed:`, msg);
      }
    }
  }

  // 4. All models and retries exhausted — surface a clear error
  const errMsg = lastError?.message || 'Unknown error';
  if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
    throw new Error('Gemini API rate limit reached. Please wait a minute and try again.');
  }
  if (errMsg.includes('503') || errMsg.includes('overload') || errMsg.includes('unavailable')) {
    throw new Error('Gemini is temporarily overloaded. Please try again in a few minutes.');
  }
  if (errMsg.includes('fetch') || errMsg.includes('Network') || errMsg.includes('Failed to fetch')) {
    throw new Error('Network error: Unable to reach Gemini API. Please check your internet connection.');
  }
  throw new Error(`AI Schema Agent failed after all retries. Last error: ${errMsg}`);
}

/**
 * Clear cached schema for a specific file (call after user explicitly requests re-analysis)
 */
export function clearSchemaCache(fileName, rowCount, colCount) {
  try {
    localStorage.removeItem(`dsi_ai_schema_v2__${fileName}__${rowCount}__${colCount}`);
  } catch { /* silent */ }
}
