/**
 * HuggingFace Inference API integration
 * Model: Qwen/Qwen2.5-7B-Instruct (via OpenAI-compatible completions endpoint)
 * - Free, active, and supported under hf-inference provider
 * - Excellent instruction following & structured JSON output
 */

const HF_API_URL = '/api/hf/v1/chat/completions';

/**
 * Build a structured messages array for Chat Completions
 */
function buildMessages(columns, sampleRows, rowCount) {
  const sample = sampleRows.slice(0, 12);
  const sampleText = sample
    .map((row, i) =>
      `Row ${i + 1}: ${columns.map(c => `${c}=${String(row[c] ?? '').slice(0, 30)}`).join(', ')}`
    )
    .join('\n');

  const systemPrompt = `You are a business data analyst. Analyze spreadsheet data and return ONLY a valid JSON object — no explanation, no markdown fences, no extra text before or after the JSON.`;

  const userPrompt = `Dataset:
- Columns: ${columns.join(', ')}
- Total rows: ${rowCount}
- Sample (first ${sample.length} rows):
${sampleText}

Return this exact JSON structure with real values from the data:
{
  "summary": "2-3 sentence executive summary of what this dataset contains and key findings",
  "kpis": [
    { "label": "relevant KPI name", "value": "formatted value with unit", "trend": "up", "trendValue": "+X%" },
    { "label": "relevant KPI name", "value": "formatted value", "trend": "up", "trendValue": "+X%" },
    { "label": "relevant KPI name", "value": "formatted value", "trend": "down", "trendValue": "-X%" },
    { "label": "relevant KPI name", "value": "formatted value", "trend": "up", "trendValue": "+X%" }
  ],
  "insights": [
    "Specific insight sentence 1 with numbers",
    "Specific insight sentence 2 with numbers",
    "Specific insight sentence 3 with numbers",
    "Specific insight sentence 4 with numbers",
    "Specific insight sentence 5 with numbers"
  ],
  "recommendations": [
    { "title": "Action title", "desc": "Specific actionable recommendation" },
    { "title": "Action title", "desc": "Specific actionable recommendation" },
    { "title": "Action title", "desc": "Specific actionable recommendation" }
  ],
  "chartData": [
    { "name": "Category from data", "value": 1234 },
    { "name": "Category from data", "value": 5678 }
  ],
  "trendData": [
    { "month": "Jan", "revenue": 10000 },
    { "month": "Feb", "revenue": 12000 },
    { "month": "Mar", "revenue": 11000 },
    { "month": "Apr", "revenue": 15000 },
    { "month": "May", "revenue": 14000 },
    { "month": "Jun", "revenue": 17000 }
  ]
}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

/**
 * Extract JSON from LLM output — handles extra text, markdown fences, etc.
 */
function extractJSON(text) {
  // Strip markdown fences if present
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Find first { ... } block
  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = clean.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Try fixing common JSON issues
      const fixed = candidate
        .replace(/,\s*([}\]])/g, '$1')   // trailing commas
        .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)(['"])?:/g, '"$2":') // unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"'); // single-quoted strings
      return JSON.parse(fixed);
    }
  }
  throw new Error('No valid JSON found in model response');
}

/**
 * Main export: send Excel data to HuggingFace Qwen and get structured analysis
 */
export async function analyzeDataWithAI(columns, rows, apiToken, onProgress) {
  onProgress?.('Sending data to Qwen-7B on HuggingFace...');

  const messages = buildMessages(columns, rows, rows.length);

  let response;
  try {
    response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: messages,
        temperature: 0.2,
        max_tokens: 1500
      }),
    });
  } catch (networkErr) {
    throw new Error(
      'Network error — could not reach HuggingFace. Check your internet connection and try again.'
    );
  }

  if (!response.ok) {
    let errBody = {};
    try { errBody = await response.json(); } catch { /* ignore */ }

    if (response.status === 401 || response.status === 403) {
      if (errBody.error && errBody.error.includes('permissions to call Inference Providers')) {
        throw new Error(
          'Your HuggingFace API token is missing the "Make calls to Inference Providers" permission. Please edit your token at huggingface.co/settings/tokens to enable this permission and update your .env file.'
        );
      }
      throw new Error(
        'Invalid or expired API token. Please generate a new token at huggingface.co/settings/tokens and update your .env file.'
      );
    }
    if (response.status === 503) {
      throw new Error(
        'Model is loading on HuggingFace servers (cold start). Please wait 20–30 seconds and click Analyze again.'
      );
    }
    if (response.status === 429) {
      throw new Error(
        'Rate limit reached. Please wait a minute and try again.'
      );
    }
    throw new Error(errBody.error || `HuggingFace API error: ${response.status}`);
  }

  onProgress?.('Parsing AI analysis...');

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content || '';

  if (!rawText.trim()) {
    throw new Error('Model returned an empty response. Please try again.');
  }

  let parsed;
  try {
    parsed = extractJSON(rawText);
  } catch {
    throw new Error(
      'Could not parse model response as JSON. The model may have returned unexpected text. Try again.'
    );
  }

  // Validate & fill safe defaults
  return {
    summary: typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary
      : `Analysis of ${rows.length.toLocaleString()} rows across ${columns.length} columns.`,

    kpis: Array.isArray(parsed.kpis) && parsed.kpis.length >= 1
      ? parsed.kpis.slice(0, 4).map(k => ({
          label:      String(k.label      || 'KPI'),
          value:      String(k.value      || '—'),
          trend:      k.trend === 'down' ? 'down' : 'up',
          trendValue: String(k.trendValue || '+0%'),
        }))
      : [{ label: 'Total Records', value: String(rows.length), trend: 'up', trendValue: '+100%' }],

    insights: Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 6).map(String)
      : [],

    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 4).map(r => ({
          title: String(r.title || ''),
          desc:  String(r.desc  || ''),
        }))
      : [],

    chartData: Array.isArray(parsed.chartData)
      ? parsed.chartData.filter(d => d.name && d.value != null)
      : [],

    trendData: Array.isArray(parsed.trendData)
      ? parsed.trendData.filter(d => d.month && d.revenue != null)
      : [],

    analysisRaw: rawText,
  };
}
