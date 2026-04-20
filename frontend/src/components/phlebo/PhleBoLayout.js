import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarCheck, ClipboardList,
  LogOut, Menu, X, ChevronRight, Stethoscope
} from 'lucide-react';
import './PhleBoLayout.css';

const navItems = [
  { to: '/phlebo',             icon: LayoutDashboard, label: "Today's Schedule", exact: true },
  { to: '/phlebo/assignments', icon: CalendarCheck,   label: 'All Assignments'  },
];

export default function PhleBoLayout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [open, setOpen]  = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (item) => item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <div className={`phlebo-layout ${open ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="phlebo-sidebar">
        <div className="ps-header">
          <div className="ps-brand">
            <div className="ps-brand-icon"><Stethoscope size={18}/></div>
            {open && (
              <div>
                <div className="ps-brand-name">LabCollect</div>
                <div className="ps-brand-sub">Phlebotomist Portal</div>
              </div>
            )}
          </div>
          <button className="ps-toggle" onClick={() => setOpen(!open)}>
            {open ? <X size={16}/> : <Menu size={16}/>}
          </button>
        </div>

        {open && (
          <div className="ps-user-card">
            <div className="ps-avatar">{user?.name?.charAt(0)}</div>
            <div>
              <div className="ps-user-name">{user?.name}</div>
              <div className="ps-user-role">Phlebotomist</div>
            </div>
          </div>
        )}

        <nav className="ps-nav">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`ps-item ${isActive(item) ? 'active' : ''}`}
              title={!open ? item.label : ''}
            >
              <item.icon size={19}/>
              {open && <span>{item.label}</span>}
              {open && isActive(item) && <ChevronRight size={13} className="ps-chevron"/>}
            </Link>
          ))}
        </nav>

        <div className="ps-footer">
          <button className="ps-logout" onClick={handleLogout} title="Logout">
            <LogOut size={16}/>
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="phlebo-main">
        <header className="phlebo-topbar">
          <div className="pt-left">
            <button className="pt-menu-btn" onClick={() => setOpen(!open)}>
              <Menu size={20}/>
            </button>
            <div className="pt-title">
              {navItems.find(n => isActive(n))?.label || 'My Assignments'}
            </div>
          </div>
          <div className="pt-right">
            <div className="pt-user">
              <div className="pt-avatar">{user?.name?.charAt(0)}</div>
              <span>{user?.name}</span>
            </div>
          </div>
        </header>

        <div className="phlebo-content">
          <Outlet/>
        </div>
      </div>
    </div>
  );
}