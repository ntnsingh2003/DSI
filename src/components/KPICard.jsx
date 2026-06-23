import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KPICard({ label, value, trend, trendValue, desc, icon: Icon, iconBg, index = 0 }) {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const isNA = trendValue === 'N/A' || !trendValue;

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
      {desc && <div className="kpi-desc">{desc}</div>}
      <div className="kpi-trend">
        {isNA ? (
          <>
            <span className="tag-neutral">N/A</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No previous month data available</span>
          </>
        ) : (
          <>
            {isUp ? (
              <TrendingUp size={14} color="var(--success)" />
            ) : isDown ? (
              <TrendingDown size={14} color="var(--danger)" />
            ) : (
              <Minus size={14} color="var(--text-muted)" />
            )}
            <span className={isUp ? 'tag-up' : isDown ? 'tag-down' : 'tag-neutral'}>{trendValue}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>vs last month</span>
          </>
        )}
      </div>
    </div>
  );
}

