import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useData } from '../context/DataContext';
import {
  Send, BarChart2, FileText, Share2, Zap,
  ChevronRight, FileSpreadsheet, MessageSquare,
  TrendingUp, AlertTriangle, Lightbulb, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { askGeminiChat } from '../api/gemini';

function TypingIndicator() {
  return (
    <div className="msg-row" style={{ animationDelay: '0s' }}>
      <div className="msg-avatar ai">D</div>
      <div>
        <div className="msg-bubble ai">
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Build a context-aware response from real uploadedData */
function buildResponse(question, data) {
  const q = question.toLowerCase();
  const cur = data.currencyPrefix || '₹';

  if (q.includes('summar') || q.includes('overview') || q.includes('about') || q.includes('file')) {
    return {
      text: data.summary,
      pills: [
        { label: `${data.rowCount.toLocaleString()} rows scanned`, state: 'done' },
        { label: `${data.columns.length} columns analyzed`, state: 'done' },
      ],
      preview: true,
    };
  }

  if (q.includes('highest') || q.includes('max') || q.includes('peak') || q.includes('largest')) {
    return {
      text: `The **Highest Sale** recorded in this dataset is **${data.highestSaleFormatted}**.\n\nThis transaction represents the single largest order value in the selected period.`,
      pills: [
        { label: 'Highest sale queried', state: 'done' }
      ],
      preview: false
    };
  }

  if (q.includes('lowest') || q.includes('min') || q.includes('smallest')) {
    return {
      text: `The **Lowest Sale** recorded in this dataset is **${data.lowestSaleFormatted}**.\n\nThis transaction represents the single smallest order value in the selected period.`,
      pills: [
        { label: 'Lowest sale queried', state: 'done' }
      ],
      preview: false
    };
  }

  if (q.includes('aov') || q.includes('average order') || q.includes('average transaction')) {
    return {
      text: `The **Average Order Value (AOV)** is **${data.avgOrderValueFormatted}**.\n\nThis is calculated as Total Sales (${data.totalRevenueFormatted}) divided by the transaction count (${data.transactionCount.toLocaleString()}).`,
      pills: [
        { label: 'AOV calculated', state: 'done' }
      ],
      preview: false
    };
  }

  if (q.includes('revenue') || q.includes('sale') || q.includes('performance') || q.includes('earn') || q.includes('kpi') || q.includes('metric')) {
    const kpiLines = data.kpis.map(k => `**${k.label}:** ${k.value} (${k.trendValue})`).join('\n');
    return {
      text: `Here are the key metrics computed from **${data.fileName}**:\n\n${kpiLines}`,
      pills: [
        { label: 'KPIs retrieved', state: 'done' },
        { label: 'Trends calculated', state: 'done' },
      ],
      preview: true,
    };
  }

  if (q.includes('order') || q.includes('qty') || q.includes('unit') || q.includes('sold') || q.includes('count')) {
    return {
      text: `Based on the uploaded file, here is the order volume breakdown:\n- **Total Orders KPI:** ${data.totalUnits.toLocaleString()} (sum of Units Sold as per requirements)\n- **Transaction/Row Count:** ${data.transactionCount.toLocaleString()} individual orders\n- **Total Products/Units Sold:** ${data.totalUnits.toLocaleString()} units`,
      pills: [
        { label: 'Orders parsed', state: 'done' },
        { label: 'Volume aggregated', state: 'done' }
      ],
      preview: false
    };
  }

  if (q.includes('category') || q.includes('categories') || q.includes('segment')) {
    const categoriesList = data.chartData.map((cat, i) => `${i + 1}. **${cat.name}** — ${cur}${cat.value.toLocaleString()}`).join('\n');
    return {
      text: `There are **${data.uniqueCategoriesCount}** unique categories in **${data.fileName}**.\n\n**Top Category:** "${data.topCategory}" contributes **${data.topCategoryShare}%** of total sales.\n\n**Revenue Breakdown by Category:**\n${categoriesList}\n\n**Low-Performing Category:** "${data.bottomCategory}"`,
      pills: [
        { label: 'Categories analyzed', state: 'done' },
      ],
      preview: false,
    };
  }

  if (q.includes('product') || q.includes('top seller') || q.includes('popular')) {
    return {
      text: `The top-selling product by total sales revenue is **"${data.topProduct}"**, which contributed **${data.topProductShare}%** of all sales revenue.\n\nTo see the full product breakdowns, please view the **Reports** or **Dashboard** tabs.`,
      pills: [
        { label: 'Products analyzed', state: 'done' }
      ],
      preview: false
    };
  }

  if (q.includes('insight') || q.includes('finding') || q.includes('pattern') || q.includes('trend') || q.includes('discover')) {
    const insightLines = data.insights.map((ins, i) => `${i + 1}. ${ins}`).join('\n');
    return {
      text: `Key insights from **${data.fileName}**:\n\n${insightLines}`,
      pills: [
        { label: 'Patterns identified', state: 'done' },
        { label: 'Anomalies checked', state: 'done' },
      ],
      preview: false,
    };
  }

  if (q.includes('recommend') || q.includes('suggest') || q.includes('action') || q.includes('next step') || q.includes('what should')) {
    const recLines = data.recommendations.map((r, i) => `**${i + 1}. ${r.title}**\n${r.desc}`).join('\n\n');
    return {
      text: `Based on **${data.fileName}**, here are the recommendations:\n\n${recLines}`,
      pills: [
        { label: 'Analysis complete', state: 'done' },
        { label: 'Recommendations ready', state: 'done' },
      ],
      preview: false,
    };
  }

  if (q.includes('column') || q.includes('field') || q.includes('structure') || q.includes('data type')) {
    return {
      text: `**${data.fileName}** has **${data.columns.length} columns** and **${data.rowCount.toLocaleString()} rows**.\n\nColumns detected: ${data.columns.map(c => `\`${c}\``).join(', ')}`,
      pills: [
        { label: `${data.columns.length} columns found`, state: 'done' },
      ],
      preview: false,
    };
  }

  if (q.includes('anomal') || q.includes('outlier') || q.includes('problem') || q.includes('issue') || q.includes('risk') || q.includes('decline')) {
    return {
      text: `Potential risks and findings in **${data.fileName}**:\n\n- Low-performing category: **"${data.bottomCategory}"**\n- Smallest transaction value recorded: **${data.lowestSaleFormatted}**\n\nThe overall dataset looks consistent with ${data.rowCount.toLocaleString()} rows and no major structural errors.`,
      pills: [
        { label: 'Anomaly scan complete', state: 'done' },
      ],
      preview: false,
    };
  }

  return {
    text: `I can help you analyze **${data.fileName}** offline.\n\n${data.summary}\n\nTry asking about:\n- **Total Sales & Revenue**\n- **Total Orders / Quantity Sold**\n- **Average Order Value (AOV)**\n- **Highest and Lowest Sale**\n- **Top Product & Top Category**\n- **Insights & Recommendations**`,
    pills: [
      { label: `${data.fileName} loaded`, state: 'done' },
    ],
    preview: true,
  };
}

// BUG-01 FIX: msgId moved inside component via useRef — no more global mutable var
export default function Chat() {
  const { uploadedData } = useData();

  // BUG-01 FIX: useRef for stable, non-resetting ID counter
  const msgIdRef = useRef(1);

  // BUG-02 FIX: Start with empty state — useEffect will populate welcome msg when data is ready
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const bottomRef               = useRef(null);

  // BUG-02 FIX: React to uploadedData changes properly — welcome message always shows
  useEffect(() => {
    if (uploadedData) {
      setMessages([{
        id: msgIdRef.current++,
        role: 'ai',
        text: `Hello! I've loaded **"${uploadedData.fileName}"** — ${uploadedData.rowCount.toLocaleString()} rows across ${uploadedData.columns.length} columns.\n\n${uploadedData.summary}\n\nWhat would you like to know?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pills: [
          { label: `${uploadedData.rowCount.toLocaleString()} rows loaded`, state: 'done' },
          { label: `${uploadedData.columns.length} columns indexed`, state: 'done' },
        ],
        preview: false,
      }]);
    } else {
      setMessages([]);
    }
  }, [uploadedData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const delay = ms => new Promise(r => setTimeout(r, ms));

  const sendMsg = async (text) => {
    // BUG-10 FIX: guard both empty string and whitespace-only
    if (!text.trim() || !uploadedData || typing) return;

    const userMsg = {
      id: msgIdRef.current++,
      role: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pills: [],
      preview: false,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    try {
      const reply = await askGeminiChat(text, uploadedData, messages);
      setTyping(false);

      const aiMsg = {
        id: msgIdRef.current++,
        role: 'ai',
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pills: [{ label: uploadedData.model || 'Gemini-2.5-Flash', state: 'done' }],
        preview: text.toLowerCase().includes('kpi') || text.toLowerCase().includes('metric') || text.toLowerCase().includes('revenue'),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setTyping(false);
      const errAlertMsg = {
        id: msgIdRef.current++,
        role: 'ai',
        text: `⚠️ **Error Contacting Gemini**\n\n${err.message}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pills: [{ label: 'Failed', state: 'pending' }],
        preview: false,
      };
      setMessages(prev => [...prev, errAlertMsg]);
    }
  };

  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>
        : part.split('\n').map((line, j, arr) => (
            <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
          ))
    );

  const getHints = () => {
    if (!uploadedData) return [];
    const type = uploadedData.datasetType;
    if (type === 'Sales' || type === 'Retail' || type === 'E-Commerce') {
      return ['Summarize sales', 'Show key metrics', 'Top product', 'Any anomalies?'];
    }
    if (type === 'Attendance') {
      return ['Attendance rate', 'Absent days', 'Late arrivals', 'Show anomalies'];
    }
    if (type === 'HR') {
      return ['Average salary', 'Active employees', 'Attrition rate', 'Show anomalies'];
    }
    if (type === 'Finance') {
      return ['Net profit', 'Total expense', 'Profit margin', 'Show anomalies'];
    }
    if (type === 'Inventory' || type === 'Warehouse') {
      return ['Stock value', 'Out of stock items', 'Low stock items', 'Show anomalies'];
    }
    return [`Summarize data`, 'Show key metrics', 'Give recommendations', 'Any anomalies?'];
  };
  const hints = getHints();

  // ── Quick-action cards shown when no data ────────────────────────────
  const quickActions = [
    { icon: TrendingUp,    label: 'Analyse Trends',      hint: 'What are the insights?'    },
    { icon: Target,        label: 'Get Recommendations', hint: 'Give recommendations'       },
    { icon: AlertTriangle, label: 'Find Anomalies',      hint: 'Any anomalies?'             },
    { icon: Lightbulb,     label: 'Key Metrics',         hint: 'Show key metrics'           },
  ];

  // ── No data uploaded state ──────────────────────────────────────────
  if (!uploadedData) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content chat-empty-main">
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <MessageSquare size={32} color="var(--blue-400)" />
            </div>
            <h2 className="chat-empty-title">No data to analyse yet</h2>
            <p className="chat-empty-desc">
              Upload an Excel or CSV file from the Dashboard. Once processed, you can ask anything about your data right here.
            </p>
            <Link to="/dashboard">
              <button className="btn-primary" style={{ gap: 8, fontSize: 15, padding: '12px 28px' }}>
                <FileSpreadsheet size={16} /> Go to Dashboard
              </button>
            </Link>
            {/* Quick action preview cards */}
            <div className="chat-quick-actions">
              {quickActions.map(({ icon: Icon, label }) => (
                <div key={label} className="chat-quick-card">
                  <Icon size={18} color="var(--blue-400)" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Main chat view ────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', padding: '24px 32px' }}>

        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="page-title">Data Chat</h1>
            <p className="page-subtitle">
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{uploadedData.fileName}</span>
              &nbsp;· {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns
            </p>
          </div>
        </div>

        <div className="chat-layout" style={{ flex: 1 }}>

          {/* Main chat window */}
          <div className="chat-main">

            {/* Top bar */}
            <div className="chat-top-bar">
              <div className="ai-status">
                <div className="ai-dot" />
                <div>
                  <div className="ai-name">DSI Analytics</div>
                  <div className="ai-tag">{uploadedData.fileName}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/dashboard">
                  <button className="btn-outline" style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}>
                    <BarChart2 size={12} /> Dashboard
                  </button>
                </Link>
                <Link to="/reports">
                  <button className="btn-outline" style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}>
                    <FileText size={12} /> Reports
                  </button>
                </Link>
                <Link to="/report/shared">
                  <button className="btn-outline" style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}>
                    <Share2 size={12} /> Share
                  </button>
                </Link>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={`msg-row ${msg.role}`} style={{ animationDelay: `${idx * 0.04}s` }}>
                  <div className={`msg-avatar ${msg.role}`}>{msg.role === 'ai' ? 'D' : 'U'}</div>
                  <div style={{ maxWidth: '72%' }}>
                    <div className={`msg-bubble ${msg.role}`}>
                      {renderText(msg.text)}
                      {msg.pills.length > 0 && (
                        <div className="msg-status-pills">
                          {msg.pills.map((p, i) => (
                            <span key={i} className={`status-pill ${p.state}`} style={{ animationDelay: `${i * 0.1}s` }}>
                              {p.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {msg.preview && (
                        <div className="dashboard-preview-card">
                          <div className="dashboard-preview-header">
                            <span><Zap size={12} style={{ display: 'inline', marginRight: 5 }} />{uploadedData.fileName}</span>
                            <Link to="/dashboard">
                              <span style={{ fontSize: 11, color: 'var(--blue-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                View full <ChevronRight size={11} />
                              </span>
                            </Link>
                          </div>
                          <div className="dashboard-mini-kpis">
                            {(uploadedData.kpis || []).slice(0, 4).map(k => (
                              <div key={k.label} className="mini-kpi">
                                <div className="mini-kpi-label">{k.label}</div>
                                <div className="mini-kpi-value">{k.value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
                            <Link to="/dashboard" style={{ flex: 1 }}>
                              <button className="btn-primary" style={{ width: '100%', fontSize: 12, padding: '7px 12px', justifyContent: 'center' }}>
                                <BarChart2 size={12} /> Open Dashboard
                              </button>
                            </Link>
                            <Link to="/reports" style={{ flex: 1 }}>
                              <button className="btn-outline" style={{ width: '100%', fontSize: 12, padding: '7px 12px', justifyContent: 'center' }}>
                                <FileText size={12} /> View Report
                              </button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="msg-meta">{msg.time}</div>
                  </div>
                </div>
              ))}
              {typing && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="chat-input-wrap">
              <div className="chat-input-row">
                <Zap size={16} color="var(--blue-400)" style={{ flexShrink: 0 }} />
                <input
                  className="chat-input"
                  placeholder={`Ask about ${uploadedData.fileName}…`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  // BUG-10 FIX: full guard — empty string AND whitespace protected
                  onKeyDown={e => e.key === 'Enter' && !typing && input.trim() && sendMsg(input)}
                  disabled={typing}
                />
                <button
                  className="chat-send-btn"
                  onClick={() => sendMsg(input)}
                  disabled={typing || !input.trim()}
                >
                  <Send size={14} color="white" />
                </button>
              </div>
              <div className="chat-input-hints">
                {hints.map(h => (
                  <button key={h} className="chat-hint" onClick={() => sendMsg(h)} disabled={typing}>{h}</button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}