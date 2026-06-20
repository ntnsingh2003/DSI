import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KPICard({ label, value, trend, trendValue, icon: Icon, iconBg, index = 0 }) {
  const isUp = trend === 'up';
  return (
    <div
      className="kpi-card animate-fadeInUp"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="kpi-icon" style={{ background: iconBg || 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <Icon size={20} color="var(--blue-400)" />
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-trend">
        {isUp
          ? <TrendingUp size={14} color="var(--success)" />
          : <TrendingDown size={14} color="var(--danger)" />
        }
        <span className={isUp ? 'tag-up' : 'tag-down'}>{trendValue}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>vs last month</span>
      </div>
    </div>
  );
}
