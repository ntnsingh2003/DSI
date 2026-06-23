/**
 * HuggingFace Inference API integration
 * Model: deepseek-ai/DeepSeek-R1-Distill-Qwen-32B (via OpenAI-compatible completions endpoint)
 * - State-of-the-art reasoning model for mathematical and logic tasks
 * - Free, active, and supported under hf-inference provider
 */

const HF_API_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.DEV)
  ? '/api/hf/v1/chat/completions' 
  : 'https://router.huggingface.co/v1/chat/completions';

/**
 * Build a structured messages array for Chat Completions
 */
function buildMessages(columns, sampleRows, rowCount, computed) {
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

  const userPrompt = `Dataset Overview:
- Columns: ${columns.join(', ')}
- Total rows: ${rowCount}

CRITICAL: Here are the EXACT calculated mathematical metrics computed from the entire dataset. You MUST write your text summary, insights, and recommendations to match these exact numbers:
- Total Revenue: ${computed.totalRevenueFormatted}
- Total Units Sold: ${computed.totalUnits.toLocaleString()}
- Total Orders: ${computed.totalOrders.toLocaleString()}
- Average Order Value: ${computed.avgOrderValueFormatted}
- Category Breakdown (chartData): ${JSON.stringify(computed.chartData)}
- Trend Data (trendData): ${JSON.stringify(computed.trendData)}

Sample (first ${sample.length} rows):
${sampleText}

Return this exact JSON structure with real values from the data:
{
  "summary": "2-3 sentence executive summary of what this dataset contains and key findings",
  "kpis": [
    { "label": "Total Revenue", "value": "${computed.totalRevenueFormatted}", "trend": "up", "trendValue": "+0%" },
    { "label": "Total Units Sold", "value": "${computed.totalUnits.toLocaleString()}", "trend": "up", "trendValue": "+0%" },
    { "label": "Avg Order Value", "value": "${computed.avgOrderValueFormatted}", "trend": "up", "trendValue": "+0%" },
    { "label": "Total Orders", "value": "${computed.totalOrders.toLocaleString()}", "trend": "up", "trendValue": "+0%" }
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
  "chartData": ${JSON.stringify(computed.chartData)},
  "trendData": ${JSON.stringify(computed.trendData)}
}

REMINDER: Your JSON must match the exact kpis, chartData, and trendData structures above. Make sure your "summary", "insights", and "recommendations" mention the correct numbers!`;

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
 * Main export: send Excel data to HuggingFace DeepSeek-R1 and get structured analysis
 */
export async function analyzeDataWithAI(columns, rows, apiToken, onProgress) {
  // 1. Calculate exact deterministic metrics
  const computed = computeDataMetrics(columns, rows);

  onProgress?.('Sending data to DeepSeek-R1 on HuggingFace...');

  const messages = buildMessages(columns, rows, rows.length, computed);

  let response;
  try {
    response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
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
    model: 'DeepSeek-R1-32B',
    summary: typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary
      : `Analysis of ${rows.length.toLocaleString()} rows.`,

    // Override math with mathematically perfect calculations
    kpis: computed.kpis.map((ck, idx) => {
      const ak = parsed.kpis?.[idx];
      return {
        label: ck.label,
        value: ck.value,
        trend: ak?.trend === 'down' ? 'down' : 'up',
        trendValue: ak?.trendValue && ak.trendValue.endsWith('%') ? ak.trendValue : ck.trendValue
      };
    }),

    insights: Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 6).map(String)
      : [],

    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 4).map(r => ({
          title: String(r.title || ''),
          desc:  String(r.desc  || ''),
        }))
      : [],

    chartData: computed.chartData,
    trendData: computed.trendData,
    analysisRaw: rawText,
  };
}

/**
 * Robust Client-Side Data Metric Computations
 * Automatically identifies roles for columns (Revenue, Quantity, Category, Date)
 * and calculates exact metrics, categories, and date trends.
 */
export function computeDataMetrics(columns, rows) {
  if (!rows || rows.length === 0) {
    return {
      kpis: [],
      chartData: [],
      trendData: [],
      totalRevenue: 0,
      totalOrders: 0,
      totalUnits: 0,
      avgOrderValue: 0,
      totalRevenueFormatted: '0',
      avgOrderValueFormatted: '0',
    };
  }

  // 1. Identify columns with robust semantic check
  let revenueCol = columns.find(c => {
    const l = String(c).toLowerCase();
    return (l.includes('total') && l.includes('sale')) ||
           (l.includes('total') && l.includes('rev')) ||
           l === 'revenue' || l === 'sales' || l === 'amount' || l === 'total sales' || l === 'total_sales' || l === 'net_revenue' || l === 'net revenue';
  });
  if (!revenueCol) {
    revenueCol = columns.find(c => {
      const l = String(c).toLowerCase();
      return l.includes('revenue') || l.includes('sale') || l.includes('amount') || l.includes('price');
    });
  }
  if (!revenueCol) revenueCol = columns[0];

  let qtyCol = columns.find(c => {
    const l = String(c).toLowerCase();
    return l.includes('qty') || l.includes('quantity') || l.includes('unit') || l.includes('sold') || l.includes('count');
  });

  let categoryCol = columns.find(c => {
    const l = String(c).toLowerCase();
    return l.includes('category') || l.includes('type') || l.includes('group') || l.includes('class') || l === 'product' || l === 'item';
  });
  if (!categoryCol) {
    categoryCol = columns.find(c => {
      const l = String(c).toLowerCase();
      return l.includes('product') || l.includes('item');
    });
  }
  if (!categoryCol) categoryCol = columns[0];

  let dateCol = columns.find(c => {
    const l = String(c).toLowerCase();
    return l.includes('date') || l.includes('time') || l.includes('month') || l.includes('year') || l.includes('day') || l.includes('created');
  });

  // Extract currency prefix dynamically
  let currencyPrefix = '$';
  const headerWithCurrency = columns.find(c => c.includes('₹') || c.includes('INR') || c.includes('$') || c.includes('€') || c.includes('£'));
  if (headerWithCurrency) {
    if (headerWithCurrency.includes('₹') || headerWithCurrency.includes('INR')) currencyPrefix = '₹';
    else if (headerWithCurrency.includes('€')) currencyPrefix = '€';
    else if (headerWithCurrency.includes('£')) currencyPrefix = '£';
  } else {
    const sampleVal = rows.find(r => r[revenueCol] && typeof r[revenueCol] === 'string' && /[\₹\$\€\£]/g.test(r[revenueCol]));
    if (sampleVal) {
      const match = String(sampleVal[revenueCol]).match(/[\₹\$\€\£]/);
      if (match) currencyPrefix = match[0];
    }
  }

  const cleanNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const parseDate = (val) => {
    if (val instanceof Date) return val;
    if (!val) return null;
    const num = Number(val);
    if (!isNaN(num) && num > 25569 && num < 100000) {
      return new Date((num - 25569) * 86400 * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  // 2. Calculations
  let totalRevenue = 0;
  let totalUnits = 0;
  const categories = {};
  const dates = [];
  const rawDates = [];

  rows.forEach(r => {
    const rev = cleanNumber(r[revenueCol]);
    const qty = qtyCol ? cleanNumber(r[qtyCol]) : 1;
    const cat = String(r[categoryCol] || 'Other').trim();

    totalRevenue += rev;
    totalUnits += qty;
    categories[cat] = (categories[cat] || 0) + rev;

    if (dateCol) {
      const dt = parseDate(r[dateCol]);
      if (dt) {
        dates.push({ date: dt, revenue: rev });
        rawDates.push(dt);
      }
    }
  });

  const totalOrders = rows.length;
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

  const totalRevenueFormatted = currencyPrefix + Math.round(totalRevenue).toLocaleString();
  const avgOrderValueFormatted = currencyPrefix + (avgOrderValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 3. Category Breakdown Data
  const chartData = Object.entries(categories).map(([name, value]) => ({
    name,
    value: Math.round(value)
  })).sort((a, b) => b.value - a.value).slice(0, 8);

  // 4. Trend Data
  let groupBy = 'month';
  if (rawDates.length > 0) {
    const minDate = new Date(Math.min(...rawDates));
    const maxDate = new Date(Math.max(...rawDates));
    const diffTime = Math.abs(maxDate - minDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 40) {
      groupBy = 'day';
    }
  }

  const trendMap = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  dates.forEach(d => {
    let key;
    if (groupBy === 'day') {
      const day = String(d.date.getDate()).padStart(2, '0');
      const m = monthNames[d.date.getMonth()];
      key = `${day} ${m}`;
    } else {
      key = monthNames[d.date.getMonth()];
    }
    trendMap[key] = (trendMap[key] || 0) + d.revenue;
  });

  let trendData = [];
  if (groupBy === 'day') {
    const sortedDates = [...dates].sort((a, b) => a.date - b.date);
    const uniqueKeys = [];
    sortedDates.forEach(d => {
      const day = String(d.date.getDate()).padStart(2, '0');
      const m = monthNames[d.date.getMonth()];
      const key = `${day} ${m}`;
      if (!uniqueKeys.includes(key)) {
        uniqueKeys.push(key);
      }
    });
    trendData = uniqueKeys.map(key => ({
      month: key,
      revenue: Math.round(trendMap[key] || 0)
    }));
  } else {
    trendData = monthNames
      .filter(m => trendMap[m] !== undefined)
      .map(m => ({
        month: m,
        revenue: Math.round(trendMap[m])
      }));

    if (trendData.length === 0) {
      const chunk = Math.round(totalRevenue / 6);
      trendData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => ({
        month: m,
        revenue: chunk
      }));
    }
  }

  // 5. KPIs
  const kpis = [
    { label: 'Total Revenue', value: totalRevenueFormatted, trend: 'up', trendValue: '+0%' },
    { label: qtyCol ? 'Total Units Sold' : 'Total Records', value: totalUnits.toLocaleString(), trend: 'up', trendValue: '+0%' },
    { label: 'Avg Order Value', value: avgOrderValueFormatted, trend: 'up', trendValue: '+0%' },
    { label: 'Total Orders', value: totalOrders.toLocaleString(), trend: 'up', trendValue: '+0%' }
  ];

  return {
    kpis,
    chartData,
    trendData,
    totalRevenue,
    totalOrders,
    totalUnits,
    avgOrderValue,
    totalRevenueFormatted,
    avgOrderValueFormatted
  };
}
