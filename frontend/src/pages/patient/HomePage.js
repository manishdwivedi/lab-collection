import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCategories, getTests } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import {
  FlaskConical, Home, Clock, Shield, ChevronRight, Plus, Check,
  Star, Phone, Droplets, Activity, Heart
} from 'lucide-react';
import toast from 'react-hot-toast';
import './HomePage.css';

const features = [
  { icon: Home, title: 'Home Collection', desc: 'Book a slot and our technician comes to you' },
  { icon: Clock, title: 'Quick Reports', desc: 'Receive digital reports within hours' },
  { icon: Shield, title: 'NABL Certified', desc: 'Highest quality standards maintained' },
  { icon: Star, title: 'Trusted by 10,000+', desc: 'Patients across Ludhiana' },
];

const categoryIcons = { droplet: Droplets, activity: Activity, heart: Heart, flask: FlaskConical };

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [popularTests, setPopularTests] = useState([]);
  const { addToCart, isInCart } = useCart();

  useEffect(() => {
    getCategories().then(r => { console.log(r); setCategories(r.data.categories.slice(0, 6)); } );
    getTests().then(r => setPopularTests(r.data.tests.slice(0, 6)));
  }, []);

  const handleAddToCart = (test) => {
    addToCart(test);
    toast.success(`${test.name} added to cart`);
  };

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <FlaskConical size={14}/> Ludhiana's Most Trusted Lab
            </div>
            <h1 className="hero-title">
              Diagnostic Tests<br/>
              <span>At Your Doorstep</span>
            </h1>
            <p className="hero-subtitle">
              Book blood tests, health packages and more — from the comfort of your home.
              Accurate results, affordable prices, trusted by thousands.
            </p>
            <div className="hero-actions">
              <Link to="/tests" className="btn btn-accent btn-lg">
                Browse Tests <ChevronRight size={18}/>
              </Link>
              <a href="tel:+919876543210" className="btn btn-outline-white btn-lg">
                <Phone size={16}/> Call Us
              </a>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><strong>10,000+</strong><span>Happy Patients</span></div>
              <div className="hero-stat-divider"/>
              <div className="hero-stat"><strong>200+</strong><span>Tests Available</span></div>
              <div className="hero-stat-divider"/>
              <div className="hero-stat"><strong>24/7</strong><span>Support</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-card-float hero-card-1">
              <div className="hc-icon"><Droplets size={20}/></div>
              <div><div className="hc-label">CBC Report</div><div className="hc-sub">Ready in 6 hrs</div></div>
            </div>
            <div className="hero-blob"/>
            <div className="hero-card-float hero-card-2">
              <Check size={16} className="hc-check"/>
              <span>Sample Collected!</span>
            </div>
            <div className="hero-card-float hero-card-3">
              <Activity size={18}/>
              <div><div className="hc-label">Thyroid Panel</div><div className="hc-val">₹850</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="section-container">
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon"><f.icon size={22}/></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="section-container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Browse by Category</h2>
              <p className="section-sub">Find the right test for your health needs</p>
            </div>
            <Link to="/tests" className="btn btn-outline btn-sm">View All <ChevronRight size={14}/></Link>
          </div>
          <div className="categories-grid">
            {categories.map(cat => (
              <Link key={cat.id} to={`/tests?category=${cat.id}`} className="category-card">
                <div className="cat-icon">
                  <FlaskConical size={24}/>
                </div>
                <div className="cat-name">{cat.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Tests */}
      <section className="section section-alt">
        <div className="section-container">
          <div className="section-header">
            <div>
              <h2 className="section-title">Popular Tests</h2>
              <p className="section-sub">Most booked tests by our patients</p>
            </div>
            <Link to="/tests" className="btn btn-outline btn-sm">View All <ChevronRight size={14}/></Link>
          </div>
          <div className="tests-grid">
            {popularTests.map(test => (
              <div key={test.id} className="test-card-home">
                <div className="test-card-top">
                  <div className="test-code">{test.code}</div>
                  {test.fasting_required && <span className="fasting-badge">Fasting</span>}
                </div>
                <h3 className="test-name">{test.name}</h3>
                <div className="test-meta">
                  <span>🧪 {test.sample_type}</span>
                  <span>⏱ {test.report_time}</span>
                </div>
                <div className="test-card-bottom">
                  <div className="test-price">₹{parseFloat(test.base_price).toFixed(0)}</div>
                  <button
                    className={`btn btn-sm ${isInCart(test.id) ? 'btn-success-outline' : 'btn-primary'}`}
                    onClick={() => !isInCart(test.id) && handleAddToCart(test)}
                  >
                    {isInCart(test.id) ? <><Check size={14}/> Added</> : <><Plus size={14}/> Add</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-card">
            <h2>Ready to get tested?</h2>
            <p>Book your home collection now. Our trained phlebotomist will visit you at the scheduled time.</p>
            <Link to="/tests" className="btn btn-accent btn-lg">
              Book Now <ChevronRight size={18}/>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
