import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import KPICard from '../components/KPICard';
import ExcelUploader from '../components/ExcelUploader';
import { RevenueAreaChart, CategoryBarChart } from '../components/RevenueChart';
import { useData } from '../context/DataContext';
import {
  DollarSign, ShoppingCart, TrendingUp, TrendingDown, Users, BarChart2,
  Share2, Download, RefreshCw, ExternalLink, FileSpreadsheet, MessageSquare,
  Sparkles, AlertTriangle, CheckCircle2, Target, Lightbulb, Send, Zap, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { askGeminiChat } from '../api/gemini';

const ICON_MAP = {
  'Total Sales': DollarSign,
  'Total Orders': ShoppingCart,
  'Average Order Value': BarChart2,
  'Total Products Sold': Users,
  'Highest Sale': TrendingUp,
  'Lowest Sale': TrendingDown,
};

const ICON_BKGS = {
  'Total Sales': 'rgba(59,130,246,0.1)',
  'Total Orders': 'rgba(99,102,241,0.1)',
  'Average Order Value': 'rgba(245,158,11,0.1)',
  'Total Products Sold': 'rgba(16,185,129,0.1)',
  'Highest Sale': 'rgba(20,184,166,0.1)',
  'Lowest Sale': 'rgba(239,68,68,0.1)',
};

export default function Dashboard() {
  const { uploadedData, setUploadedData } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const handleAnalysisDone = () => {
    // data is already set in context by ExcelUploader
  };

  const handleExport = () => {
    if (!uploadedData || !uploadedData.rows || uploadedData.rows.length === 0) return;
    
    const headers = uploadedData.columns;
    const csvContent = [
      headers.join(','),
      ...uploadedData.rows.map(row => 
        headers.map(header => {
          const val = String(row[header] ?? '').replace(/"/g, '""');
          return (val.includes(',') || val.includes('\n') || val.includes('\r') || val.includes('"'))
            ? `"${val}"` : val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dsi_export_${uploadedData.fileName || 'data.csv'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── No data: show upload screen ─────────────────────────────
  if (!uploadedData) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Business Dashboard</h1>
              <p className="page-subtitle">Upload your Excel or CSV file to get started</p>
            </div>
          </div>

          <div style={{ maxWidth: 600, margin: '48px auto' }}>
            {/* Upload heading */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ width: 60, height: 60, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FileSpreadsheet size={28} color="var(--blue-400)" />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Upload your data</h2>
            </div>

            {/* Uploader */}
            <ExcelUploader onAnalysisComplete={handleAnalysisDone} />
          </div>
        </main>
      </div>
    );
  }

  // ── Data loaded: show dashboard ─────────────────────────────
  const kpis = uploadedData.kpis.map((k, i) => ({
    label: k.label,
    value: k.value,
    desc: k.desc,
    trend: k.trend || 'up',
    trendValue: k.trendValue || '+0%',
    icon: ICON_MAP[k.label] || BarChart2,
    iconBg: ICON_BKGS[k.label] || 'rgba(59,130,246,0.1)',
  }));

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        {/* Data Banner */}
        <div className="data-banner">
          <FileSpreadsheet size={15} />
          <span>Live data from:</span>
          <span className="data-banner-file">{uploadedData.fileName}</span>
          <span className="data-banner-meta">
            · {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns · AI analyzed
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Link to="/chat">
              <button className="btn-outline" style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}>
                <MessageSquare size={11} /> Ask AI
              </button>
            </Link>
            <button
              className="btn-outline"
              style={{ fontSize: 11, padding: '4px 10px', gap: 4, color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
              onClick={() => setUploadedData(null)}
            >
              Change file
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{uploadedData.fileName}</h1>
            <p className="page-subtitle">AI-generated dashboard · {uploadedData.model || 'Gemini-2.5-Flash'}</p>
          </div>
          <div className="page-actions">
            <button className="btn-outline" onClick={handleRefresh} style={{ gap: 6 }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button className="btn-outline" onClick={handleExport} style={{ gap: 6 }}><Download size={14} /> Export</button>
            <Link to="/report/shared">
              <button className="btn-primary" style={{ gap: 6 }}><Share2 size={14} /> Share</button>
            </Link>
          </div>
        </div>

        {/* Gemini Unavailability / Fallback Warning Banner */}
        {uploadedData.isGeminiUnavailable && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 10,
            marginBottom: 20,
            color: '#f59e0b',
            fontSize: 14,
            fontWeight: 500
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{uploadedData.geminiError || "AI insights are temporarily unavailable due to Gemini server load. Local analytics are still available."}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="kpi-grid">
          {kpis.map((kpi, i) => (
            <KPICard key={kpi.label} {...kpi} index={i} />
          ))}
        </div>

        {/* Executive Summary Card */}
        {uploadedData.summary && (
          <div className="report-hero animate-fadeInUp" style={{ padding: '24px 28px', marginBottom: 28 }}>
            <div className="report-meta" style={{ marginBottom: 12 }}>
              <span className="badge badge-blue"><Sparkles size={11} /> Executive Summary</span>
              <span className="badge badge-green"><CheckCircle2 size={11} /> Gemini 2.5 Flash Analyzed</span>
            </div>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              {uploadedData.summary}
            </p>
          </div>
        )}

        {/* Charts */}
        {(uploadedData.trendData?.length > 0 || uploadedData.chartData?.length > 0) && (
          <div className="chart-grid">
            {uploadedData.trendData?.length > 0 && (
              <div className="chart-card">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">Revenue Trend</div>
                    <div className="chart-card-subtitle">From {uploadedData.fileName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--blue-500)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Revenue</span>
                    </div>
                    {uploadedData.trendData[0]?.target !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 2, borderRadius: 2, background: 'var(--blue-400)', opacity: 0.5 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Target</span>
                      </div>
                    )}
                  </div>
                </div>
                <RevenueAreaChart data={uploadedData.trendData} />
              </div>
            )}
            <div className="chart-card">
              <div className="chart-card-header">
                <div>
                  <div className="chart-card-title">Category Breakdown</div>
                  <div className="chart-card-subtitle">AI-extracted from your data</div>
                </div>
              </div>
              {uploadedData.categoryColExists ? (
                <CategoryBarChart data={uploadedData.chartData} />
              ) : (
                <div style={{
                  height: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 8,
                  margin: '0 20px 20px 20px',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}>
                  Category data not available in the dataset.
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Insights, Recommendations & Anomalies */}
        {uploadedData.insights && (
          <div className="chart-grid" style={{ marginBottom: 28, gridTemplateColumns: '1fr 1fr' }}>
            {/* Insights Card */}
            <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="chart-card-header" style={{ marginBottom: 4 }}>
                <div>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                    <Lightbulb size={18} color="var(--blue-400)" />
                    AI Business Insights
                  </div>
                  <div className="chart-card-subtitle">Key trends generated by Gemini 2.5 Flash</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploadedData.insights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-400)', minWidth: 20 }}>0{i+1}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations & Anomalies Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Recommendations Section */}
              <div className="chart-card" style={{ flex: 1, padding: 20 }}>
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                    <Target size={18} color="var(--blue-400)" />
                    Actionable Recommendations
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {uploadedData.recommendations?.map((rec, i) => (
                    <div key={i} style={{ fontSize: 13, padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{rec.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4 }}>{rec.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anomalies Section */}
              <div className="chart-card" style={{ padding: 20 }}>
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    Data Anomalies & Outliers
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {uploadedData.anomalies && uploadedData.anomalies.length > 0 ? (
                    uploadedData.anomalies.map((anom, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 12 }}>
                        <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{anom}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No major data anomalies detected by Gemini.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Embedded AI Chat Section */}
        <div className="chart-card" style={{ marginBottom: 28 }}>
          <div className="chart-card-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={18} color="var(--blue-400)" />
                Quick AI Data Assistant
              </div>
              <div className="chart-card-subtitle">Query this dataset instantly powered by Google Gemini 2.5 Flash</div>
            </div>
          </div>
          <DashboardChatWidget data={uploadedData} />
        </div>

        {/* Data Table */}
        <div className="data-table-card" style={{ marginBottom: 28 }}>
          <div className="data-table-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Data Preview</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                First 10 of {uploadedData.rowCount.toLocaleString()} rows
              </div>
            </div>
            <Link to="/reports">
              <button className="btn-outline" style={{ fontSize: 12, padding: '6px 14px', gap: 5 }}>
                Full Report <ExternalLink size={12} />
              </button>
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {uploadedData.columns.slice(0, 7).map(c => <th key={c}>{c}</th>)}
                  {uploadedData.columns.length > 7 && <th>+{uploadedData.columns.length - 7} more</th>}
                </tr>
              </thead>
              <tbody>
                {uploadedData.rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {uploadedData.columns.slice(0, 7).map((c, j) => (
                      <td key={c} style={j === 0 ? { fontWeight: 600, color: 'var(--text-primary)' } : {}}>
                        {String(row[c] ?? '—').slice(0, 28)}
                      </td>
                    ))}
                    {uploadedData.columns.length > 7 && <td style={{ color: 'var(--text-muted)' }}>…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

function DashboardChatWidget({ data }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  const handleSend = async (txt = query) => {
    const activeText = txt.trim();
    if (!activeText || loading) return;
    setError('');
    
    const userMsg = { role: 'user', text: activeText };
    setHistory(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const reply = await askGeminiChat(activeText, data, history);
      setHistory(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading, error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 350, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {history.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13, gap: 10, textAlign: 'center' }}>
            <Zap size={22} color="var(--blue-400)" />
            <div>
              Ask Gemini anything about this dataset.<br/>
              Try: <em>"What is the total revenue?"</em> or <em>"Any recommendations?"</em>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
              {['Show anomalies', 'Top performing category', 'Average Order Value'].map(hint => (
                <button
                  key={hint}
                  className="chat-hint"
                  onClick={() => { handleSend(hint); }}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.5,
              background: msg.role === 'user' ? 'linear-gradient(135deg, var(--blue-600), var(--blue-500))' : 'var(--bg-card)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              borderBottomRightRadius: msg.role === 'user' ? 2 : 12,
              borderBottomLeftRadius: msg.role === 'user' ? 12 : 2,
              whiteSpace: 'pre-line'
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', alignItems: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <Loader2 size={12} className="upload-spinner" style={{ animation: 'spin 0.7s linear infinite' }} />
            <span>DSI Assistant is thinking...</span>
          </div>
        )}
        {error && (
          <div style={{ display: 'flex', gap: 6, alignSelf: 'center', padding: '6px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: 'var(--danger)', fontSize: 12 }}>
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, background: 'rgba(0,0,0,0.1)' }}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type your question about the data..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={loading}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '8px 16px', fontSize: 13 }}
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !query.trim()}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue-600), var(--blue-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, cursor: 'pointer' }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}