import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarCheck, Plus, LogOut,
  Menu, X, ChevronRight, Building2, TestTubes
} from 'lucide-react';
import './ClientLayout.css';
import './ClientLayout.css';

const navItems = [
  { to: '/client',          icon: LayoutDashboard, label: 'Dashboard',    exact: true },
  { to: '/client/bookings', icon: CalendarCheck,   label: 'My Bookings' },
  { to: '/client/new',      icon: Plus,            label: 'New Booking'  },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [open, setOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/client/login'); };

  const isActive = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <div className={`client-layout ${open ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="client-sidebar">
        <div className="cs-header">
          <div className="cs-brand">
            <div className="cs-brand-icon"><TestTubes size={18}/></div>
            {open && (
              <div>
                <div className="cs-brand-name">LabCollect</div>
                <div className="cs-brand-sub">Client Portal</div>
              </div>
            )}
          </div>
          <button className="cs-toggle" onClick={() => setOpen(!open)}>
            {open ? <X size={16}/> : <Menu size={16}/>}
          </button>
        </div>

        <nav className="cs-nav">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`cs-item ${isActive(item) ? 'active' : ''}`}
              title={!open ? item.label : ''}
            >
              <item.icon size={19}/>
              {open && <span>{item.label}</span>}
              {open && isActive(item) && <ChevronRight size={13} className="cs-chevron"/>}
            </Link>
          ))}
        </nav>

        <div className="cs-footer">
          {open && (
            <div className="cs-user">
              <div className="cs-avatar"><Building2 size={16}/></div>
              <div>
                <div className="cs-user-name">{user?.name}</div>
                <div className="cs-user-role">Client Portal</div>
              </div>
            </div>
          )}
          <button className="cs-logout" onClick={handleLogout} title="Logout">
            <LogOut size={16}/>
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="client-main">
        <header className="client-topbar">
          <div className="ct-left">
            <button className="ct-menu-btn" onClick={() => setOpen(!open)}><Menu size={20}/></button>
            <span className="ct-breadcrumb">
              {navItems.find(n => isActive(n))?.label || 'Client Portal'}
            </span>
          </div>
          <div className="ct-right">
            <Link to="/client/new" className="btn btn-primary btn-sm">
              <Plus size={14}/> New Booking
            </Link>
          </div>
        </header>
        <div className="client-content">
          <Outlet/>
        </div>
      </div>
    </div>
  );
}