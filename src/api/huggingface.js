/**
 * HuggingFace Inference API integration
 * Model: Qwen/Qwen2.5-7B-Instruct (via OpenAI-compatible completions endpoint)
 * - Free, active, and supported under hf-inference provider
 * - Excellent instruction following & structured JSON output
 */

const HF_API_URL = import.meta.env.DEV 
  ? '/api/hf/v1/chat/completions' 
  : 'https://router.huggingface.co/v1/chat/completions';

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

  const systemPrompt = `You are a business data analyst. Analyze spreadsheet data and return ONLY a valid JSON object — no explanation, no markdown fences, no extra text before or after the JSON.

CRITICAL MATHEMATICAL RULES — you MUST follow these exactly:
1. All numeric values in "kpis", "chartData", and "trendData" must be mathematically consistent.
2. If you include a "Total Revenue" or similar sum KPI, it MUST equal the sum of all values in "chartData" AND approximately equal the sum of all "revenue" values in "trendData".
3. "Avg Order Value" MUST equal Total Revenue divided by Total Orders (rounded to 2 decimal places).
4. All trendValue fields MUST include the % sign (e.g., "+12.5%" not "+12.5").
5. All numeric values in chartData and trendData MUST be plain numbers (no currency symbols, no commas).`;

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
    { "name": "Category A from data", "value": 50000 },
    { "name": "Category B from data", "value": 30000 },
    { "name": "Category C from data", "value": 20000 }
  ],
  "trendData": [
    { "month": "Jan", "revenue": 8000 },
    { "month": "Feb", "revenue": 9000 },
    { "month": "Mar", "revenue": 9500 },
    { "month": "Apr", "revenue": 10000 },
    { "month": "May", "revenue": 11000 },
    { "month": "Jun", "revenue": 11500 },
    { "month": "Jul", "revenue": 9000 },
    { "month": "Aug", "revenue": 9500 },
    { "month": "Sep", "revenue": 8000 },
    { "month": "Oct", "revenue": 6000 },
    { "month": "Nov", "revenue": 4500 },
    { "month": "Dec", "revenue": 4000 }
  ]
}

REMINDER: chartData values (50000+30000+20000 = 100000) and trendData sum (8000+9000+...+4000 = 100000) must match your Total Revenue KPI. Adjust actual numbers to match your dataset — these are just examples of the format.`;

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
    model: 'Qwen-7B',
    summary: typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary
      : `Analysis of ${rows.length.toLocaleString()} rows across ${columns.length} columns.`,

    kpis: Array.isArray(parsed.kpis) && parsed.kpis.length >= 1
      ? parsed.kpis.slice(0, 4).map(k => {
          // Ensure trendValue always has a % sign
          let tv = String(k.trendValue || '+0%').trim();
          if (tv && !tv.endsWith('%')) tv = tv + '%';
          return {
            label:      String(k.label || 'KPI'),
            value:      String(k.value || '—'),
            trend:      k.trend === 'down' ? 'down' : 'up',
            trendValue: tv,
          };
        })
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

    // Parse chartData values as numbers (AI may return strings like "1234")
    chartData: Array.isArray(parsed.chartData)
      ? parsed.chartData
          .map(d => ({ name: String(d.name || ''), value: Number(d.value) }))
          .filter(d => d.name && !isNaN(d.value) && d.value > 0)
      : [],

    // Parse trendData revenue values as numbers (AI may return strings)
    trendData: Array.isArray(parsed.trendData)
      ? parsed.trendData
          .map(d => ({ month: String(d.month || ''), revenue: Number(d.revenue) }))
          .filter(d => d.month && !isNaN(d.revenue) && d.revenue >= 0)
      : [],

    analysisRaw: rawText,
  };
}
