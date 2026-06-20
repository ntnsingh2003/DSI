import { useState } from 'react';
import { RevenueAreaChart, CategoryBarChart, PIE_COLORS } from '../components/RevenueChart';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
import {
  Shield, Globe, Lock, Share2, TrendingUp,
  Download, ChevronRight, CheckCircle2, Zap,
  FileSpreadsheet, AlertCircle
} from 'lucide-react';

function NoReport() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AlertCircle size={28} color="#ef4444" />
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Report not found</h2>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.7 }}>
        This shared report link is invalid or has expired. Generate a new one by uploading your data.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/chat">
          <button className="btn-primary" style={{ gap: 6 }}><Zap size={14} /> Upload & Analyze Data</button>
        </Link>
        <Link to="/">
          <button className="btn-outline" style={{ gap: 6 }}>Back to Home</button>
        </Link>
      </div>
    </div>
  );
}

export default function SharedReport() {
  const { uploadedData } = useData();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (!uploadedData) return <NoReport />;

  return (
    <div className="shared-page">
      {/* Top Bar */}
      <div className="shared-topbar">
        <div className="shared-branding">
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#2563eb,#60a5fa)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: 'white' }}>D</div>
          <span style={{ fontWeight: 800, fontSize: 17, background: 'linear-gradient(135deg,#fff,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginLeft: 8 }}>DSI</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>· Shared Dashboard</span>
        </div>

        <div className="shared-url-bar">
          <Lock size={10} color="var(--success)" />
          <span>dsi.ai/report/abc123</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="badge badge-green" style={{ fontSize: 11 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }} />
            Live
          </div>
          <button 
            onClick={handleCopyLink}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 999, fontSize: 12, color: copied ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Share2 size={11} /> {copied ? 'Link Copied!' : 'Share'}
          </button>
          <Link to="/">
            <button className="btn-primary" style={{ fontSize: 12, padding: '7px 16px', gap: 6 }}>
              <Zap size={12} /> Get DSI
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="shared-content">
        {/* Header */}
        <div className="shared-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="badge badge-blue"><Globe size={11} /> Public Report</span>
            <span className="badge badge-green"><CheckCircle2 size={11} /> AI Verified</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns · Qwen-7B
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>
            {uploadedData.fileName}
            <span className="gradient-text" style={{ display: 'block', fontSize: 22 }}>
              AI Analysis Dashboard
            </span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 680 }}>
            {uploadedData.summary}
          </p>
        </div>

        <div className="shared-body">
          {/* KPI Row */}
          {uploadedData.kpis?.length > 0 && (
            <div className="kpi-grid" style={{ marginBottom: 28 }}>
              {uploadedData.kpis.map((k, i) => (
                <div key={k.label} className="kpi-card animate-fadeInUp" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: 14 }}>
                    <TrendingUp size={18} color="var(--blue-400)" />
                  </div>
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value">{k.value}</div>
                  <div className="kpi-trend">
                    <TrendingUp size={12} color={k.trend === 'up' ? 'var(--success)' : 'var(--danger)'} />
                    <span style={{ color: k.trend === 'up' ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{k.trendValue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          {(uploadedData.trendData?.length > 0 || uploadedData.chartData?.length > 0) && (
            <div className="chart-grid" style={{ marginBottom: 24 }}>
              {uploadedData.trendData?.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <div>
                      <div className="chart-card-title">Revenue Trend</div>
                      <div className="chart-card-subtitle">{uploadedData.fileName}</div>
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>Live</span>
                  </div>
                  <RevenueAreaChart data={uploadedData.trendData} />
                </div>
              )}
              {uploadedData.chartData?.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <div>
                      <div className="chart-card-title">Category Breakdown</div>
                      <div className="chart-card-subtitle">AI-extracted</div>
                    </div>
                  </div>
                  <CategoryBarChart data={uploadedData.chartData} />
                </div>
              )}
            </div>
          )}

          {/* Insights */}
          {uploadedData.insights?.length > 0 && (
            <div className="report-section" style={{ marginBottom: 24 }}>
              <div className="report-section-title" style={{ fontSize: 16, marginBottom: 14 }}>
                <Zap size={16} color="var(--blue-400)" />
                AI-Generated Key Insights
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploadedData.insights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }} className="animate-fadeInUp">
                    <CheckCircle2 size={15} color="var(--blue-400)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button onClick={handleExportPDF} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Download size={12} /> Download PDF
                </button>
                <button onClick={handleCopyLink} style={{ flex: 1, padding: '9px', background: 'transparent', border: copied ? '1px solid var(--success)' : '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 12, color: copied ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Share2 size={12} /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* File info */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <FileSpreadsheet size={14} color="var(--blue-400)" />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{uploadedData.fileName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns</span>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}