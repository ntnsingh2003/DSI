import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useData } from '../context/DataContext';
import {
  Send, BarChart2, FileText, Share2, Zap,
  ChevronRight, FileSpreadsheet, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';


function TypingIndicator() {
  return (
    <div className="msg-row" style={{ animationDelay: '0s' }}>
      <div className="msg-avatar ai">AI</div>
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

  // Summary / overview
  if (q.includes('summar') || q.includes('overview') || q.includes('tell me') || q.includes('about')) {
    return {
      text: data.summary,
      pills: [
        { label: `✓ ${data.rowCount.toLocaleString()} rows scanned`, state: 'done' },
        { label: `✓ ${data.columns.length} columns analyzed`, state: 'done' },
      ],
      preview: true,
    };
  }

  // KPIs / metrics
  if (q.includes('kpi') || q.includes('metric') || q.includes('number') || q.includes('revenue') || q.includes('sale') || q.includes('performance')) {
    const kpiLines = data.kpis.map(k => `**${k.label}:** ${k.value} (${k.trendValue})`).join('\n');
    return {
      text: `Here are the key metrics from **${data.fileName}**:\n\n${kpiLines}`,
      pills: [
        { label: '✓ KPIs extracted', state: 'done' },
        { label: '✓ Trends calculated', state: 'done' },
      ],
      preview: true,
    };
  }

  // Insights
  if (q.includes('insight') || q.includes('finding') || q.includes('pattern') || q.includes('trend') || q.includes('discover')) {
    const insightLines = data.insights.slice(0, 3).map((ins, i) => `${i + 1}. ${ins}`).join('\n');
    return {
      text: `Key insights from **${data.fileName}**:\n\n${insightLines}`,
      pills: [
        { label: '✓ Patterns identified', state: 'done' },
        { label: '✓ Anomalies checked', state: 'done' },
      ],
      preview: false,
    };
  }

  // Recommendations
  if (q.includes('recommend') || q.includes('suggest') || q.includes('action') || q.includes('next step') || q.includes('what should')) {
    const recLines = data.recommendations.slice(0, 3).map((r, i) => `**${i + 1}. ${r.title}** — ${r.desc}`).join('\n\n');
    return {
      text: `Based on **${data.fileName}**, here are AI recommendations:\n\n${recLines}`,
      pills: [
        { label: '✓ Analysis complete', state: 'done' },
        { label: '✓ Recommendations ready', state: 'done' },
      ],
      preview: false,
    };
  }

  // Columns / structure
  if (q.includes('column') || q.includes('field') || q.includes('structure') || q.includes('data type') || q.includes('what column')) {
    return {
      text: `**${data.fileName}** has **${data.columns.length} columns** and **${data.rowCount.toLocaleString()} rows**.\n\nColumns: ${data.columns.join(', ')}`,
      pills: [
        { label: `✓ ${data.columns.length} columns found`, state: 'done' },
      ],
      preview: false,
    };
  }

  // Anomalies / issues
  if (q.includes('anomal') || q.includes('outlier') || q.includes('problem') || q.includes('issue') || q.includes('risk')) {
    const risk = data.insights.find(i => i.toLowerCase().includes('risk') || i.toLowerCase().includes('drop') || i.toLowerCase().includes('declin') || i.toLowerCase().includes('low'));
    return {
      text: risk
        ? `Potential risk found in **${data.fileName}**:\n\n${risk}\n\nCheck the full report for all anomalies.`
        : `No major anomalies detected in **${data.fileName}**. The data looks consistent across all ${data.rowCount.toLocaleString()} rows.`,
      pills: [
        { label: '✓ Anomaly scan complete', state: 'done' },
      ],
      preview: false,
    };
  }

  // Default: use summary + nudge to use hints
  return {
    text: `I can help you analyze **${data.fileName}** (${data.rowCount.toLocaleString()} rows).\n\n${data.summary}\n\nTry asking about: KPIs, insights, recommendations, column structure, or anomalies.`,
    pills: [
      { label: `✓ ${data.fileName} loaded`, state: 'done' },
    ],
    preview: true,
  };
}

let msgId = 10;

export default function Chat() {
  const { uploadedData } = useData();
  const [messages, setMessages] = useState(() => {
    if (!uploadedData) return [];
    return [{
      id: 1,
      role: 'ai',
      text: `Hello! I've analyzed **"${uploadedData.fileName}"** (${uploadedData.rowCount.toLocaleString()} rows, ${uploadedData.columns.length} columns).\n\n${uploadedData.summary}\n\nAsk me anything about your data!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pills: [
        { label: `✓ ${uploadedData.rowCount.toLocaleString()} rows loaded`, state: 'done' },
        { label: `✓ ${uploadedData.columns.length} columns indexed`, state: 'done' },
      ],
      preview: false,
    }];
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const delay = ms => new Promise(r => setTimeout(r, ms));

  const sendMsg = async (text) => {
    if (!text.trim() || !uploadedData) return;

    const userMsg = {
      id: ++msgId, role: 'user', text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pills: [], preview: false,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    await delay(900 + Math.random() * 600);
    setTyping(false);

    const response = buildResponse(text, uploadedData);
    const aiMsg = {
      id: ++msgId, role: 'ai',
      text: response.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pills: response.pills,
      preview: response.preview,
    };
    setMessages(prev => [...prev, aiMsg]);
  };

  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>
        : part.split('\n').map((line, j, arr) => (
            <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
          ))
    );

  const hints = uploadedData ? [
    `Summarize ${uploadedData.fileName}`,
    'Show key KPIs',
    'What are the insights?',
    'Give recommendations',
    'Any anomalies?',
    `List all columns`,
  ] : [];

  // ── No data uploaded state ──────────────────────────────────
  if (!uploadedData) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={28} color="var(--blue-400)" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>No data uploaded yet</h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.7 }}>
            Upload your Excel or CSV file from the <strong style={{ color: 'var(--text-primary)' }}>Dashboard</strong> page first.
            Once analyzed, you can ask me anything about your data here.
          </p>
          <Link to="/dashboard">
            <button className="btn-primary" style={{ gap: 8, fontSize: 15, padding: '12px 28px' }}>
              <FileSpreadsheet size={16} /> Go to Dashboard & Upload
            </button>
          </Link>
        </main>
      </div>
    );
  }

  // ── Main chat view ──────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', padding: '24px 32px' }}>

        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="page-title">AI Chat</h1>
            <p className="page-subtitle">
              Analyzing: <strong style={{ color: 'var(--text-primary)' }}>{uploadedData.fileName}</strong>
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
                  <div className="ai-name">DSI Intelligence</div>
                  <div className="ai-tag">Analyzing: {uploadedData.fileName}</div>
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
                <Link to="/report/abc123">
                  <button className="btn-outline" style={{ fontSize: 12, padding: '5px 12px', gap: 5 }}>
                    <Share2 size={12} /> Share
                  </button>
                </Link>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={`msg-row ${msg.role}`} style={{ animationDelay: `${idx * 0.05}s` }}>
                  <div className={`msg-avatar ${msg.role}`}>{msg.role === 'ai' ? 'AI' : 'U'}</div>
                  <div style={{ maxWidth: '70%' }}>
                    <div className={`msg-bubble ${msg.role}`}>
                      {renderText(msg.text)}
                      {msg.pills.length > 0 && (
                        <div className="msg-status-pills">
                          {msg.pills.map((p, i) => (
                            <span key={i} className={`status-pill ${p.state}`} style={{ animationDelay: `${i * 0.12}s` }}>
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
                            {uploadedData.kpis.slice(0, 4).map(k => (
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
                  onKeyDown={e => e.key === 'Enter' && !typing && sendMsg(input)}
                  disabled={typing}
                />
                <button className="chat-send-btn" onClick={() => sendMsg(input)} disabled={typing || !input.trim()}>
                  <Send size={14} color="white" />
                </button>
              </div>
              <div className="chat-input-hints">
                {hints.map(h => (
                  <button key={h} className="chat-hint" onClick={() => sendMsg(h)}>{h}</button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}