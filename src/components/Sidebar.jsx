import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, BarChart2,
  FileText, Settings, ChevronRight, Zap
} from 'lucide-react';

const navItems = [
  { label: 'Home',       icon: LayoutDashboard, path: '/'          },
  { label: 'AI Chat',    icon: MessageSquare,   path: '/chat'      },
  { label: 'Dashboards', icon: BarChart2,       path: '/dashboard' },
  { label: 'Reports',    icon: FileText,        path: '/reports'   },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">D</div>
        <span className="sidebar-logo-text">DSI</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <span className="sidebar-label">Main</span>
        {navItems.map(({ label, icon: Icon, path }) => (
          <Link
            key={label}
            to={path}
            className={`sidebar-item ${pathname === path ? 'active' : ''}`}
          >
            <Icon size={16} />
            {label}
            {pathname === path && (
              <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
            )}
          </Link>
        ))}
      </nav>
    </aside>
  );
}