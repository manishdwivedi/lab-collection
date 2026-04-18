import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarCheck, TestTube, Users, ListOrdered,
  LogOut, Menu, X, ChevronRight, Bell, TestTubes, UserCog,
  FlaskConical, Key, BookOpen
} from 'lucide-react';
import './AdminLayout.css';

const navItems = [
  { to: '/admin',            icon: LayoutDashboard, label: 'Dashboard',       exact: true },
  { to: '/admin/bookings',   icon: CalendarCheck,   label: 'Bookings'         },
  { to: '/admin/phlebos',    icon: UserCog,         label: 'Phlebotomists'    },
  { to: '/admin/tests',      icon: TestTube,        label: 'Tests & Services' },
  { to: '/admin/clients',    icon: Users,           label: 'Clients'          },
  { to: '/admin/rate-lists', icon: ListOrdered,     label: 'Rate Lists'       },
  { to: '/admin/labs',       icon: FlaskConical,    label: 'Third-Party Labs' },
  { to: '/admin/api-keys',   icon: Key,             label: 'API Keys'         },
  { to: '/admin/api-docs',   icon: BookOpen,        label: 'API Docs'         },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  const isActive = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <div className={`admin-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="admin-brand">
            <div className="admin-brand-icon"><TestTubes size={20}/></div>
            {sidebarOpen && (
              <div>
                <div className="admin-brand-name">LabCollect</div>
                <div className="admin-brand-sub">Admin Panel</div>
              </div>
            )}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-item ${isActive(item) ? 'active' : ''}`}
              title={!sidebarOpen ? item.label : ''}
            >
              <item.icon size={20}/>
              {sidebarOpen && <span>{item.label}</span>}
              {sidebarOpen && isActive(item) && <ChevronRight size={14} className="active-indicator"/>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen && (
            <div className="sidebar-user">
              <div className="user-avatar">{user?.name?.charAt(0)}</div>
              <div>
                <div className="user-name">{user?.name}</div>
                <div className="user-role">Administrator</div>
              </div>
            </div>
          )}
          <button className="sidebar-logout" onClick={handleLogout} title="Logout">
            <LogOut size={18}/>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={22}/>
            </button>
            <div className="breadcrumb">
              {navItems.find(n => isActive(n))?.label || 'Dashboard'}
            </div>
          </div>
          <div className="topbar-right">
            <button className="topbar-btn"><Bell size={18}/></button>
            <div className="topbar-user">
              <div className="topbar-avatar">{user?.name?.charAt(0)}</div>
              <span>{user?.name}</span>
            </div>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}