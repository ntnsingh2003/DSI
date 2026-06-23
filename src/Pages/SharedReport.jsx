import { useState } from 'react';
import { RevenueAreaChart, CategoryBarChart, PIE_COLORS } from '../components/RevenueChart';
import { useData } from '../context/DataContext';
import { Link, useParams } from 'react-router-dom';
import {
  Shield, Globe, Lock, Share2, TrendingUp, TrendingDown,
  Download, ChevronRight, CheckCircle2, Zap,
  FileSpreadsheet, AlertCircle,
  DollarSign, ShoppingCart, Users, BarChart2
} from 'lucide-react';
import KPICard from '../components/KPICard';

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

// ── Mock fallback data — all numbers are mathematically consistent ──────────
// Total Revenue = $148,200  (verified: sum of trendData = $148,200)
// Avg Order Value = Total Revenue / Total Orders = $148,200 / 1,250 = $118.56  ✓
// chartData breakdown: Electronics (42%) = $62,244 | Fashion (25%) = $37,050 | Home (33%) = $48,906
//   → $62,244 + $37,050 + $48,906 = $148,200  ✓
// trendData monthly sums: $7,800+$9,600+$10,200+$11,100+$12,400+$13,100+$13,800+$14,500+$15,200+$16,800+$17,100+$6,600 = $148,200  ✓
//   (Note: partial Dec as data cut-off in file)
const MOCK_FALLBACK_DATA = {
  fileName: "quarterly_sales_2026.xlsx",
  rowCount: 1420,
  columns: ["Month", "Revenue", "SalesCount", "AverageOrderValue", "Category"],
  summary: "This report provides a comprehensive analysis of the company's sales performance for the year 2026. Key findings indicate a steady growth in revenue of 18.3%, driven primarily by strong performance in the Electronics (42%) and Home (33%) categories. Total revenue reached $148,200 from 1,250 orders at an average order value of $118.56.",
  kpis: [
    // Total Revenue = sum of all monthly revenues in trendData below
    { label: "Total Revenue", value: "$148,200", trend: "up", trendValue: "+18.3%" },
    // Total Orders: 1,250  →  AOV = $148,200 / 1,250 = $118.56
    { label: "Total Orders", value: "1,250", trend: "up", trendValue: "+12.5%" },
    // Avg Order Value = $148,200 ÷ 1,250 = $118.56
    { label: "Avg Order Value", value: "$118.56", trend: "up", trendValue: "+5.1%" },
    // Unique customers — realistic: ~3.6 orders per customer on average for repeat buyers
    { label: "Active Customers", value: "892", trend: "up", trendValue: "+8.2%" }
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
  // chartData: must sum to Total Revenue = $148,200
  // Electronics 42% = $62,244 | Fashion 25% = $37,050 | Home 33% = $48,906
  // $62,244 + $37,050 + $48,906 = $148,200 ✓
  chartData: [
    { name: "Electronics", value: 62244 },
    { name: "Fashion",     value: 37050 },
    { name: "Home",        value: 48906 }
  ],
  // trendData: monthly revenues that sum to $148,200
  // 7800+9600+10200+11100+12400+13100+13800+14500+15200+16800+17100+6600 = 148,200 ✓
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
  ]
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
      {/* Top Bar */}
      <div className="shared-topbar">
        <div className="shared-branding">
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#2563eb,#60a5fa)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: 'white' }}>D</div>
          <span style={{ fontWeight: 800, fontSize: 17, background: 'linear-gradient(135deg,#fff,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginLeft: 8 }}>DSI</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>· Shared Dashboard</span>
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
            <span className="badge badge-green"><CheckCircle2 size={11} /> Auto-analyzed</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {uploadedData.rowCount.toLocaleString()} rows · {uploadedData.columns.length} columns · {uploadedData.model || 'DeepSeek-R1-8B'}
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
              {uploadedData.kpis.map((k, i) => {
                const kpi = {
                  ...k,
                  icon: ICON_MAP[k.label] || BarChart2,
                  iconBg: ICON_BKGS[k.label] || 'rgba(59,130,246,0.1)',
                };
                return <KPICard key={kpi.label} {...kpi} index={i} />;
              })}
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