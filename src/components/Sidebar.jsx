import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, MessageSquare, BarChart2,
  FileText, Settings, ChevronRight, Zap, Menu, X
} from 'lucide-react';

const navItems = [
  { label: 'Home',       icon: LayoutDashboard, path: '/'          },
  { label: 'AI Chat',    icon: MessageSquare,   path: '/chat'      },
  { label: 'Dashboards', icon: BarChart2,       path: '/dashboard' },
  { label: 'Reports',    icon: FileText,        path: '/reports'   },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Header (hidden on desktop) */}
      <div className="mobile-top-bar">
        <button className="mobile-toggle-btn" onClick={() => setIsOpen(true)} aria-label="Toggle navigation">
          <Menu size={20} color="var(--text-primary)" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, var(--blue-600), var(--blue-400))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: 'white' }}>D</div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>DSI</span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay Backdrop */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar Drawer */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Close Button (visible only on mobile) */}
        <button className="sidebar-close-btn" onClick={() => setIsOpen(false)} aria-label="Close menu">
          <X size={18} color="var(--text-secondary)" />
        </button>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">D</div>
          <span className="sidebar-logo-text">DSI</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <span className="sidebar-label">Main</span>
          {navItems.map(({ label, icon: Icon, path }) => {
            // BUG-09: active checking for dynamic subroutes
            const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path);
            return (
              <Link
                key={label}
                to={path}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={16} />
                {label}
                {isActive && (
                  <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}