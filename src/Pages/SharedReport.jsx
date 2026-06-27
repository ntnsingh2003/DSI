import { useState } from 'react';
import { RevenueAreaChart, CategoryBarChart } from '../components/RevenueChart';
import { useData } from '../context/DataContext';
import { Link, useParams } from 'react-router-dom';
import {
  Shield, Globe, Lock, Share2, TrendingUp, TrendingDown,
  Download, ChevronRight, CheckCircle2, Zap,
  FileSpreadsheet, AlertCircle, AlertTriangle, Target,
  DollarSign, ShoppingCart, Users, BarChart2, Activity
} from 'lucide-react';
import KPICard from '../components/KPICard';

const ICON_MAP = {
  'Total Sales': DollarSign,
  'Total Revenue': DollarSign,
  'Total Income': DollarSign,
  'Total Expense': TrendingDown,
  'Net Profit': DollarSign,
  'Total Orders': ShoppingCart,
  'Ad Spend': DollarSign,
  'Average Order Value': BarChart2,
  'Total Products Sold': Users,
  'Units Sold': Users,
  'Highest Sale': TrendingUp,
  'Lowest Sale': TrendingDown,
  'Attendance Rate': CheckCircle2,
  'Present Days': CheckCircle2,
  'Active Employees': Users,
  'Attrition Rate': Users,
  'Average Score': Target,
  'Win Rate %': Target,
  'Stock Value': FileSpreadsheet,
  'Unique SKUs': FileSpreadsheet,
};

const ICON_BKGS = {
  'Total Sales': 'rgba(59,130,246,0.1)',
  'Total Revenue': 'rgba(59,130,246,0.1)',
  'Total Income': 'rgba(59,130,246,0.1)',
  'Total Expense': 'rgba(239,68,68,0.1)',
  'Net Profit': 'rgba(16,185,129,0.1)',
  'Total Orders': 'rgba(99,102,241,0.1)',
  'Average Order Value': 'rgba(245,158,11,0.1)',
  'Total Products Sold': 'rgba(16,185,129,0.1)',
  'Units Sold': 'rgba(16,185,129,0.1)',
  'Highest Sale': 'rgba(20,184,166,0.1)',
  'Lowest Sale': 'rgba(239,68,68,0.1)',
  'Attendance Rate': 'rgba(16,185,129,0.1)',
  'Present Days': 'rgba(16,185,129,0.1)',
  'Active Employees': 'rgba(59,130,246,0.1)',
  'Attrition Rate': 'rgba(239,68,68,0.1)',
  'Average Score': 'rgba(99,102,241,0.1)',
  'Win Rate %': 'rgba(20,184,166,0.1)',
  'Stock Value': 'rgba(245,158,11,0.1)',
  'Unique SKUs': 'rgba(99,102,241,0.1)',
};

const MOCK_FALLBACK_DATA = {
  fileName: "quarterly_sales_2026.xlsx",
  datasetType: "Sales",
  rowCount: 1420,
  columns: ["Month", "Revenue", "SalesCount", "AverageOrderValue", "Category"],
  summary: "This report provides a comprehensive analysis of the company's sales performance for the year 2026. Key findings indicate a steady growth in revenue of 18.3%, driven primarily by strong performance in the Electronics (42%) and Home (33%) categories. Total revenue reached $148,200 from 1,250 orders at an average order value of $118.56.",
  kpis: [
    { label: "Total Revenue", value: "$148,200", trend: "up", trendValue: "+18.3%", desc: "Total sales revenue generated." },
    { label: "Total Orders", value: "1,250", trend: "up", trendValue: "+12.5%", desc: "Count of transactions recorded." },
    { label: "Average Order Value", value: "$118.56", trend: "up", trendValue: "+5.1%", desc: "Average order value." },
    { label: "Units Sold", value: "3,892", trend: "up", trendValue: "+8.2%", desc: "Total units sold." }
  ],
  insights: [
    "Total revenue of $148,200 grew by 18.3% compared to the previous year, driven by holiday sales and promotional campaigns.",
    "Electronics remains the largest product category, contributing 42% ($62,244) of total sales revenue across 1,250 orders.",
    "Average Order Value (AOV) increased from $112.50 to $118.56 — a 5.4% improvement — indicating larger average cart sizes.",
    "892 active customers generated 1,250 orders (avg 1.4 orders/customer), with retention rate improving by 4% year-over-year.",
    "A minor dip in Fashion sales ($37,050 / 25% share) was observed mid-year, which recovered by Q3 through targeted promotions."
  ],
  recommendations: [
    { title: "Optimize Inventory for Electronics", desc: "Increase stock levels for top-performing electronics products to prevent stockouts. Electronics contributes 42% ($62,244) of total revenue." },
    { title: "Targeted Marketing for Fashion", desc: "Launch promotional campaigns to boost Fashion category revenue beyond its current 25% share ($37,050) by targeting low-engagement customer segments." },
    { title: "Loyalty Program Expansion", desc: "Introduce new incentives to raise the average order value above $118.56 and grow the active customer base beyond 892." }
  ],
  risks: [
    "Potential stock shortages in high-demand Electronics products due to shipping delays.",
    "Declining performance in minor categories causing marginal drag on profit growth."
  ],
  strengths: [
    "Solid revenue margins driven by primary categories (Electronics and Home).",
    "Customer repeat transaction rate increased by 12% MoM."
  ],
  weaknesses: [
    "Seasonal sales declines observed mid-year in the Fashion segment.",
    "Data collection gap in late December causing incomplete monthly analytics representation."
  ],
  opportunities: [
    "Introduce digital bundling of products to cross-sell Electronics and Home segments.",
    "Leverage email campaigns focused on customer retention during Q3."
  ],
  conclusion: "The quarterly sales performance for 2026 demonstrates robust financial health, led by Electronics. Addressing stock levels and inventory planning in Electronics while boosting Fashion sales via loyalty campaigns will drive high returns in subsequent quarters.",
  anomalies: [
    "Extreme revenue transaction outlier ($5,400) recorded in August.",
    "Expected transaction dip in December due to year-end ledger cut-offs."
  ],
  chartData: [
    { name: "Electronics", value: 62244 },
    { name: "Fashion",     value: 37050 },
    { name: "Home",        value: 48906 }
  ],
  trendData: [
    { month: "Jan", revenue: 7800  },
    { month: "Feb", revenue: 9600  },
    { month: "Mar", revenue: 10200 },
    { month: "Apr", revenue: 11100 },
    { month: "May", revenue: 12400 },
    { month: "Jun", revenue: 13100 },
    { month: "Jul", revenue: 13800 },
    { month: "Aug", revenue: 14500 },
    { month: "Sep", revenue: 15200 },
    { month: "Oct", revenue: 16800 },
    { month: "Nov", revenue: 17100 },
    { month: "Dec", revenue: 6600  }
  ],
  categoryColExists: true,
  mappedCols: { category: "Category", metric: "Revenue" }
};

export default function SharedReport() {
  const { uploadedData: contextData } = useData();
  const [copied, setCopied] = useState(false);
  const { reportId } = useParams();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const uploadedData = contextData || MOCK_FALLBACK_DATA;

  return (
    <div className="shared-page">
      {/* Printable CSS block */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .shared-topbar, .shared-url-bar, .page-actions, button {
            display: none !important;
          }
          .shared-content {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .report-section, .chart-card {
            border: 1px solid #ccc !important;
            background: white !important;
            color: black !important;
            page-break-inside: avoid;
            margin-bottom: 20px !important;
          }
          .badge, .column-badge {
            border: 1px solid #666 !important;
            color: black !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* Top Bar */}
      <div className="shared-topbar">
        <div className="shared-branding">
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#2563eb,#60a5fa)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: 'white' }}>D</div>
          <span style={{ fontWeight: 800, fontSize: 17, background: 'linear-gradient(135deg,#fff,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginLeft: 8 }}>DSI</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>· Shared Report</span>
        </div>

        <div className="shared-url-bar">
          <Lock size={10} color="var(--success)" />
          <span>dsi.ai/report/{reportId || 'shared'}</span>
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
          <button onClick={handleExportPDF} className="btn-primary" style={{ fontSize: 12, padding: '7px 16px', gap: 6 }}>
            <Download size={12} /> Export PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="shared-content">
        {/* Header */}
        <div className="shared-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="badge badge-blue"><Globe size={11} /> Public Report</span>
            <span className="badge badge-green"><CheckCircle2 size={11} /> Auto-analyzed</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns · {uploadedData.model || 'Gemini-2.5-Flash'}
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>
            {uploadedData.fileName}
            <span className="gradient-text" style={{ display: 'block', fontSize: 22 }}>
              {uploadedData.datasetType} Analysis Dashboard
            </span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 680 }}>
            {uploadedData.summary}
          </p>
        </div>

        <div className="shared-body">
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

          {/* KPI Row */}
          {uploadedData.kpis?.length > 0 && (
            <div className="kpi-grid" style={{ marginBottom: 28 }}>
              {uploadedData.kpis.map((k, i) => {
                const IconComponent = ICON_MAP[k.label] || BarChart2;
                const iconBg = ICON_BKGS[k.label] || 'rgba(59,130,246,0.1)';
                return <KPICard key={k.label} label={k.label} value={k.value} desc={k.desc} trend={k.trend || 'up'} trendValue={k.trendValue || '+0%'} icon={IconComponent} iconBg={iconBg} index={i} />;
              })}
            </div>
          )}

          {/* Data Quality Section */}
          {uploadedData.dataQuality && (
            <div className="report-section animate-fadeInUp" style={{ marginBottom: 24 }}>
              <div className="report-section-title" style={{ fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="var(--blue-400)" />
                Dataset Quality & Completeness Audit
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div style={{ padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completeness Rate</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue-400)', marginTop: 4 }}>{uploadedData.dataQuality.completeness}%</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Quality Score</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: uploadedData.dataQuality.quality > 90 ? 'var(--success)' : 'var(--warning)', marginTop: 4 }}>{uploadedData.dataQuality.quality}%</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Empty Mapped Cells</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: uploadedData.dataQuality.emptyCount > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: 4 }}>{uploadedData.dataQuality.emptyCount}</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duplicates Mapped</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: uploadedData.dataQuality.duplicatesCount > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: 4 }}>{uploadedData.dataQuality.duplicatesCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          {(uploadedData.trendData?.length > 0 || uploadedData.chartData?.length > 0) && (
            <div className="chart-grid" style={{ marginBottom: 24 }}>
              {uploadedData.trendData?.length > 0 && (
                <div className="chart-card">
                  <div className="chart-card-header">
                    <div>
                      <div className="chart-card-title">Trend over Time</div>
                      <div className="chart-card-subtitle">{uploadedData.fileName}</div>
                    </div>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>Live</span>
                  </div>
                  <RevenueAreaChart data={uploadedData.trendData} />
                </div>
              )}
              <div className="chart-card">
                <div className="chart-card-header">
                  <div>
                    <div className="chart-card-title">Breakdown Overview</div>
                    <div className="chart-card-subtitle">AI-extracted</div>
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
            </div>
          )}

          {/* AI Recommendations */}
          {uploadedData.recommendations?.length > 0 && (
            <div className="report-section" style={{ marginBottom: 24 }}>
              <div className="report-section-title" style={{ fontSize: 16, marginBottom: 14 }}>
                <Target size={16} color="var(--blue-400)" />
                AI Recommendations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploadedData.recommendations.map((rec, i) => (
                  <div key={i} style={{ padding: '16px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }} className="animate-fadeInUp">
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{rec.title}</div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{rec.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks & Weaknesses */}
          {((uploadedData.risks && uploadedData.risks.length > 0) || (uploadedData.weaknesses && uploadedData.weaknesses.length > 0)) && (
            <div className="chart-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
              <div className="chart-card">
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: 16 }}>
                    <AlertTriangle size={18} />
                    Risks & Threats
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {uploadedData.risks?.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 12px', background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 6 }}>
                      {r}
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 16 }}>
                    <AlertCircle size={18} />
                    Weaknesses
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {uploadedData.weaknesses?.map((w, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 12px', background: 'rgba(245,158,11,0.02)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: 6 }}>
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Strengths & Opportunities */}
          {((uploadedData.strengths && uploadedData.strengths.length > 0) || (uploadedData.opportunities && uploadedData.opportunities.length > 0)) && (
            <div className="chart-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
              <div className="chart-card">
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 16 }}>
                    <CheckCircle2 size={18} />
                    Strengths
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {uploadedData.strengths?.map((s, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 12px', background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: 6 }}>
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-card-header" style={{ marginBottom: 12 }}>
                  <div className="chart-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--blue-400)', fontSize: 16 }}>
                    <Target size={18} />
                    Future Opportunities
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {uploadedData.opportunities?.map((o, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '10px 12px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Data Anomalies */}
          {uploadedData.anomalies?.length > 0 && (
            <div className="report-section" style={{ marginBottom: 24 }}>
              <div className="report-section-title" style={{ fontSize: 16, marginBottom: 14 }}>
                <AlertTriangle size={16} color="#ef4444" />
                Data Anomalies & Outliers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploadedData.anomalies.map((anom, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)' }} className="animate-fadeInUp">
                    <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{anom}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conclusion */}
          {uploadedData.conclusion && (
            <div className="report-section" style={{ marginBottom: 24 }}>
              <div className="report-section-title" style={{ fontSize: 16, marginBottom: 14 }}>
                <FileSpreadsheet size={16} color="var(--blue-400)" />
                Conclusion
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                {uploadedData.conclusion}
              </p>
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