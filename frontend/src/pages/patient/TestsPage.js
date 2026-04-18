import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTests, getCategories } from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { Search, Plus, Check, ShoppingCart, Filter, FlaskConical } from 'lucide-react';
import toast from 'react-hot-toast';
import './TestsPage.css';

export default function TestsPage() {
  const [tests, setTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || '';
  const { addToCart, isInCart, cartItems } = useCart();

  useEffect(() => {
    getCategories().then(r => setCategories(r.data.categories));
  }, []);

  useEffect(() => {
    setLoading(true);
    getTests({ category_id: selectedCategory, search }).then(r => {
      setTests(r.data.tests);
      setLoading(false);
    });
  }, [selectedCategory, search]);

  const handleAdd = (test) => {
    addToCart(test);
    toast.success(`${test.name} added!`);
  };

  const grouped = tests.reduce((acc, t) => {
    const cat = t.category_name || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="tests-page">
      <div className="tests-header">
        <div className="tests-header-inner">
          <div>
            <h1>Tests & Services</h1>
            <p>Choose from 200+ diagnostic tests</p>
          </div>
          {cartItems.length > 0 && (
            <Link to="/book" className="btn btn-accent">
              <ShoppingCart size={16}/> Cart ({cartItems.length}) — Proceed
            </Link>
          )}
        </div>
      </div>

      <div className="tests-layout">
        {/* Sidebar Filters */}
        <aside className="tests-sidebar">
          <div className="filter-section">
            <div className="filter-title"><Filter size={15}/> Categories</div>
            <button
              className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
              onClick={() => setSearchParams({})}
            >
              All Tests
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`filter-btn ${selectedCategory === String(cat.id) ? 'active' : ''}`}
                onClick={() => setSearchParams({ category: cat.id })}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <div className="tests-main">
          <div className="search-bar" style={{ marginBottom: 24 }}>
            <Search size={16}/>
            <input
              className="form-control"
              placeholder="Search tests by name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading-container"><div className="spinner"/></div>
          ) : tests.length === 0 ? (
            <div className="empty-state">
              <FlaskConical size={48}/>
              <h3>No tests found</h3>
              <p>Try a different search or category</p>
            </div>
          ) : (
            Object.entries(grouped).map(([catName, catTests]) => (
              <div key={catName} className="test-group">
                <div className="test-group-header">{catName}</div>
                <div className="test-list">
                  {catTests.map(test => (
                    <div key={test.id} className="test-list-item">
                      <div className="tli-left">
                        <div className="tli-code">{test.code}</div>
                        <div>
                          <div className="tli-name">{test.name}</div>
                          <div className="tli-meta">
                            {test.sample_type && <span>🧪 {test.sample_type}</span>}
                            {test.report_time && <span>⏱ {test.report_time}</span>}
                            {test.fasting_required && <span className="fasting-badge">Fasting required</span>}
                          </div>
                        </div>
                      </div>
                      <div className="tli-right">
                        <div className="tli-price">₹{parseFloat(test.base_price).toFixed(0)}</div>
                        <button
                          className={`btn btn-sm ${isInCart(test.id) ? 'btn-added' : 'btn-primary'}`}
                          onClick={() => !isInCart(test.id) && handleAdd(test)}
                        >
                          {isInCart(test.id) ? <><Check size={14}/> Added</> : <><Plus size={14}/> Add</>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
