import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { ShoppingCart, User, LogOut, Menu, X, TestTube, Phone, MapPin } from 'lucide-react';
import './PatientLayout.css';

export default function PatientLayout() {
  const { user, logout } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/tests', label: 'Tests & Services' },
  ];

  return (
    <div className="patient-layout">
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-brand">
            <div className="brand-icon"><TestTube size={22}/></div>
            <div>
              <div className="brand-name">LabCollect</div>
              <div className="brand-tagline">Diagnostics at your door</div>
            </div>
          </Link>

          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {user ? (
              <>
                <Link to="/my-bookings" className="nav-link" onClick={() => setMenuOpen(false)}>My Bookings</Link>
                <div className="nav-user">
                  <User size={16}/>
                  <span>{user.name.split(' ')[0]}</span>
                </div>
                <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                  <LogOut size={14}/> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline btn-sm" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Register</Link>
              </>
            )}

            <Link to="/book" className="nav-cart" onClick={() => setMenuOpen(false)}>
              <ShoppingCart size={20}/>
              {cartItems.length > 0 && <span className="cart-count">{cartItems.length}</span>}
            </Link>
          </div>

          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={24}/> : <Menu size={24}/>}
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div>
              <div className="footer-brand">
                <TestTube size={20}/>
                <span>LabCollect Diagnostics</span>
              </div>
              <p className="footer-desc">Bringing quality diagnostic services to your doorstep with accuracy and care.</p>
            </div>
            <div>
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/tests">View Tests</Link></li>
                <li><Link to="/book">Book Now</Link></li>
                <li><Link to="/my-bookings">My Bookings</Link></li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <div className="footer-contact">
                <div><Phone size={14}/> +91 98765 43210</div>
                <div><MapPin size={14}/> Ludhiana, Punjab</div>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2024 LabCollect Diagnostics. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
