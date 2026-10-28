import React, { useState, useRef, useEffect } from 'react';
import { hasPermission, hasAnyPermission } from '../../utils/permissions';
import { navigate } from '../../router';

export default function CrmLayout({ user, onLogout, activeTab, setActiveTab, ordersSubView, activeDocId, docType, dcSubView, onNavigateDcSubView, poSubView, activePoId, onNavigatePoSubView, stockBranch, setStockBranch, stockProductCreate, setStockProductCreate, stockProductPriceHistory, activeProductId, stockProductInfo, financeSubView, onNavigateToCreate, onNavigateToSettings, primaryActionLabel, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isStocksExpanded, setIsStocksExpanded] = useState(() => activeTab === 'stocks');
  const [isDcExpanded, setIsDcExpanded] = useState(() => activeTab === 'delivery-challans');
  const [isPoExpanded, setIsPoExpanded] = useState(() => activeTab === 'purchase-orders');
  const [isOrdersExpanded, setIsOrdersExpanded] = useState(() => activeTab === 'orders');
  const [isFinanceExpanded, setIsFinanceExpanded] = useState(() => activeTab === 'finance');
  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (activeTab === 'stocks' && prevTabRef.current !== 'stocks') {
      setIsStocksExpanded(true);
    }
    if (activeTab === 'delivery-challans' && prevTabRef.current !== 'delivery-challans') {
      setIsDcExpanded(true);
    }
    if (activeTab === 'purchase-orders' && prevTabRef.current !== 'purchase-orders') {
      setIsPoExpanded(true);
    }
    if (activeTab === 'orders' && prevTabRef.current !== 'orders') {
      setIsOrdersExpanded(true);
    }
    if (activeTab === 'finance' && prevTabRef.current !== 'finance') {
      setIsFinanceExpanded(true);
    }
    prevTabRef.current = activeTab;
  }, [activeTab]);


  const navItems = [
    {
      id: 'enquiries',
      path: '/enquiries',
      label: 'Enquiries',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="12" y1="7" x2="12" y2="13" />
        </svg>
      )
    },
    {
      id: 'customers',
      path: '/customers',
      label: 'Customers',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      id: 'quotations',
      path: '/quotations',
      label: 'Quotations',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2h9l3 3v17H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path d="M14 2v4h4" />
          <path d="M8 11h8M8 15h6" />
        </svg>
      )
    },
    {
      id: 'delivery-challans',
      path: '/delivery-challans',
      label: 'Delivery Challans',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    },
    {
      id: 'purchase-orders',
      path: '/purchase-orders',
      label: 'Purchase Orders',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M12 11h4" />
          <path d="M12 16h4" />
          <path d="M8 11h.01" />
          <path d="M8 16h.01" />
        </svg>
      )
    },
    {
      id: 'stocks',
      path: '/stocks',
      label: 'Stocks',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )
    },
    {
      id: 'orders',
      path: '/orders',
      label: 'Orders & Deals',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      )
    },
    {
      id: 'finance',
      path: '/finance',
      label: 'Finance & Flow',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      )
    }
  ];

  const canView = (moduleName) => hasPermission(user, moduleName, 'View');
  const visibleNavItems = navItems.filter((item) => {
    if (item.id === 'enquiries') return canView('Enquiries');
    if (item.id === 'customers') return canView('Customers');
    if (item.id === 'quotations') return canView('Quotations');
    if (item.id === 'delivery-challans') return canView('Delivery Challans');
    if (item.id === 'purchase-orders') return canView('Purchase Orders');
    if (item.id === 'stocks') return canView('Stocks');
    if (item.id === 'orders') return canView('Orders & Deals');
    if (item.id === 'finance') return String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' || String(user?.role || '').toUpperCase() === 'ADMIN' || canView('Finance');
    return true;
  });
  const canCreateEnquiry = hasPermission(user, 'Enquiries', 'Create');
  const canViewEnquiries = hasPermission(user, 'Enquiries', 'View');
  const canOpenSettings = hasAnyPermission(user, [
    ['User Administration', 'View Users'],
    ['User Administration', 'Create Users'],
    ['User Administration', 'Edit Users'],
    ['User Administration', 'Manage Roles'],
    ['User Administration', 'Manage Permissions']
  ]);

  return (
    <div className="crm-app-wrapper">
      {/* SIDEBAR NAVIGATION */}
      <aside className={`crm-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="crm-sidebar-brand">
          <div className="crm-brand-icon">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-svg">
              <defs>
                <linearGradient id="sideShieldGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38bdf8" />
                  <stop offset="0.5" stopColor="#2563eb" />
                  <stop offset="1" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <path
                d="M24 4L8 10V22C8 32.5 14.8 42.2 24 44C33.2 42.2 40 32.5 40 22V10L24 4Z"
                fill="url(#sideShieldGrad)"
              />
              <path
                d="M17 23.5L22 28.5L31 18.5"
                stroke="#ffffff"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="crm-brand-details">
            <span className="crm-brand-name">ASICRM</span>
            <span className="crm-brand-tier">Enterprise SaaS</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="crm-nav-menu">
          <div className="nav-section-title">MAIN MENU</div>
          {visibleNavItems.map((item) => (
            <React.Fragment key={item.id}>
            <a
              href={item.path}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  if (item.id === 'delivery-challans') {
                    if (activeTab !== 'delivery-challans') {
                      setActiveTab(item.id);
                    }
                    setIsDcExpanded((prev) => !prev);
                  } else if (item.id === 'purchase-orders') {
                    if (activeTab !== 'purchase-orders') {
                      setActiveTab(item.id);
                    }
                    setIsPoExpanded((prev) => !prev);
                  } else if (item.id === 'stocks') {
                    if (activeTab !== 'stocks') {
                      setActiveTab(item.id);
                    }
                    setIsStocksExpanded((prev) => !prev);
                  } else if (item.id === 'orders') {
                    if (activeTab !== 'orders') {
                      setActiveTab(item.id);
                    }
                    setIsOrdersExpanded((prev) => !prev);
                  } else if (item.id === 'finance') {
                    if (activeTab !== 'finance') {
                      setActiveTab(item.id);
                    }
                    setIsFinanceExpanded((prev) => !prev);
                  } else {
                    setActiveTab(item.id);
                  }
                  setMobileMenuOpen(false);
                }
              }}
              className={`crm-nav-item ${activeTab === item.id ? 'active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
              {item.badge && <span className="nav-item-badge">{item.badge}</span>}
              {item.id === 'delivery-challans' && (
                <span
                  className="stocks-menu-chevron dc-menu-chevron"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDcExpanded((prev) => !prev);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={isDcExpanded ? "Collapse delivery challans menu" : "Expand delivery challans menu"}
                >
                  {isDcExpanded ? '▼' : '▶'}
                </span>
              )}
              {item.id === 'purchase-orders' && (
                <span
                  className="stocks-menu-chevron po-menu-chevron"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPoExpanded((prev) => !prev);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={isPoExpanded ? "Collapse purchase orders menu" : "Expand purchase orders menu"}
                >
                  {isPoExpanded ? '▼' : '▶'}
                </span>
              )}
              {item.id === 'stocks' && (
                <span
                  className="stocks-menu-chevron"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsStocksExpanded((prev) => !prev);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={isStocksExpanded ? "Collapse stocks menu" : "Expand stocks menu"}
                >
                  {isStocksExpanded ? '▼' : '▶'}
                </span>
              )}
              {item.id === 'orders' && (
                <span
                  className="stocks-menu-chevron orders-menu-chevron"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOrdersExpanded((prev) => !prev);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={isOrdersExpanded ? "Collapse orders menu" : "Expand orders menu"}
                >
                  {isOrdersExpanded ? '▼' : '▶'}
                </span>
              )}
              {item.id === 'finance' && (
                <span
                  className="stocks-menu-chevron finance-menu-chevron"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsFinanceExpanded((prev) => !prev);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={isFinanceExpanded ? "Collapse finance menu" : "Expand finance menu"}
                >
                  {isFinanceExpanded ? '▼' : '▶'}
                </span>
              )}
            </a>
            {item.id === 'delivery-challans' && isDcExpanded && (
              <div className="stocks-submenu dc-submenu">
                {[
                  ['overview', 'Overview', '/delivery-challans'],
                  ['new', 'New DC', '/delivery-challans/new'],
                  ['dispatch', 'DC Dispatch', '/delivery-challans/dispatch'],
                  ['receive', 'DC Receive', '/delivery-challans/receive'],
                  ['return', 'Return DC', '/delivery-challans/return'],
                  ['history', 'DC History', '/delivery-challans/history']
                ].map(([id, label, path]) => (
                  <a
                    key={id}
                    href={path}
                    className={`stocks-submenu-item ${
                      (dcSubView || 'overview') === id || (id === 'return' && dcSubView === 'return-new') ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        if (onNavigateDcSubView) {
                          onNavigateDcSubView(id);
                        } else {
                          navigate(path);
                        }
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    <span className="stocks-submenu-dot" />{label}
                  </a>
                ))}
              </div>
            )}
            {item.id === 'purchase-orders' && isPoExpanded && (
              <div className="stocks-submenu po-submenu">
                {[
                  ['overview', 'Overview', '/purchase-orders'],
                  ['suppliers', 'Suppliers', '/purchase-orders/suppliers'],
                  ['new', 'Create PO', '/purchase-orders/new'],
                  ['sent', 'Sent Orders to Supplier', '/purchase-orders/sent'],
                  ['receive', 'Receive Goods', '/purchase-orders/receive'],
                  ['history', 'PO History', '/purchase-orders/history']
                ].map(([id, label, path]) => (
                  <a
                    key={id}
                    href={path}
                    className={`stocks-submenu-item ${(poSubView === id || (!poSubView && id === 'overview') || (id === 'receive' && poSubView === 'receive-po')) ? 'active' : ''}`}
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        if (onNavigatePoSubView) {
                          onNavigatePoSubView(id);
                        } else {
                          navigate(path);
                        }
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    <span className="stocks-submenu-dot" />{label}
                  </a>
                ))}
              </div>
            )}
            {item.id === 'stocks' && isStocksExpanded && (
              <div className="stocks-submenu">
                {[
                  ['overview', 'Overview', '/stocks'],
                  ['categories', 'Categories', '/stocks/categories'],
                  ['subcategories', 'Subcategories', '/stocks/subcategories'],
                  ['brands', 'Brands', '/stocks/brands'],
                  ['products', 'Products', '/stocks/products']
                ].map(([id, label, path]) => (
                  <a
                    key={id}
                    href={path}
                    className={`stocks-submenu-item ${stockBranch === id && !stockProductCreate ? 'active' : ''}`}
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        setStockProductCreate?.(false);
                        setStockBranch?.(id);
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    <span className="stocks-submenu-dot" />{label}
                  </a>
                ))}
              </div>
            )}
            {item.id === 'orders' && isOrdersExpanded && (
              <div className="stocks-submenu orders-submenu">
                {[
                  ['orders', 'Orders', '/orders'],
                  ['proformas', 'Proforma', '/orders/proformas'],
                  ['invoices', 'Invoices', '/orders/invoices']
                ].map(([id, label, path]) => (
                  <a
                    key={id}
                    href={path}
                    className={`stocks-submenu-item ${
                      (ordersSubView || 'orders') === id ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        navigate(path);
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    <span className="stocks-submenu-dot" />{label}
                  </a>
                ))}
              </div>
            )}
            {item.id === 'finance' && isFinanceExpanded && (
              <div className="stocks-submenu finance-submenu">
                {[
                  ['overview', 'Overview', '/finance'],
                  ['inward', 'Inward Register', '/finance/inward'],
                  ['outward', 'Outward Register', '/finance/outward'],
                  ['serials', 'Serial Profit Tracker', '/finance/serials'],
                  ['unbilled', 'Unbilled DCs', '/finance/unbilled-dcs']
                ].map(([id, label, path]) => (
                  <a
                    key={id}
                    href={path}
                    className={`stocks-submenu-item ${
                      (financeSubView || 'overview') === id ? 'active' : ''
                    }`}
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        navigate(path);
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    <span className="stocks-submenu-dot" />{label}
                  </a>
                ))}
              </div>
            )}
            </React.Fragment>
          ))}
        </nav>

        {/* Sidebar Footer / User Info */}
        <div className="crm-sidebar-footer">
          <div className="crm-user-profile-card">
            <div className="user-avatar-circle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="user-text-info">
              <span className="user-display-name">{user?.name || 'User'}</span>
              <span className="user-mobile-tag">{user?.role ? (user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())) : 'User'}</span>
            </div>
          </div>
          <button onClick={onLogout} className="sidebar-logout-btn" title="Log out from ASICRM">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="crm-main-viewport">
        {/* TOPBAR */}
        <header className="crm-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="crm-breadcrumbs">
              <a
                href="/"
                className="breadcrumb-root"
                onClick={(e) => {
                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    navigate('/');
                  }
                }}
              >
                ASICRM
              </a>
              <span className="breadcrumb-sep">/</span>
              {activeTab === 'stocks' ? (
                (() => {
                  if (stockProductPriceHistory) {
                    if (activeProductId) {
                      const displayProdName = stockProductInfo?.name || activeProductId;
                      return (
                        <>
                          <a
                            href="/stocks"
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate('/stocks');
                              }
                            }}
                          >
                            Stocks
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <a
                            href="/stocks/products"
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate('/stocks/products');
                              }
                            }}
                          >
                            Products
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <a
                            href={`/stocks/products/${encodeURIComponent(activeProductId)}`}
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate(`/stocks/products/${encodeURIComponent(activeProductId)}`);
                              }
                            }}
                          >
                            {displayProdName}
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <span className="breadcrumb-current">Price History</span>
                        </>
                      );
                    }
                    return (
                      <>
                        <a
                          href="/stocks"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/stocks');
                            }
                          }}
                        >
                          Stocks
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">Price History</span>
                      </>
                    );
                  }

                  if (activeProductId) {
                    const displayProdName = stockProductInfo?.name || activeProductId;
                    return (
                      <>
                        <a
                          href="/stocks"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/stocks');
                            }
                          }}
                        >
                          Stocks
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <a
                          href="/stocks/products"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/stocks/products');
                            }
                          }}
                        >
                          Products
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">{displayProdName}</span>
                      </>
                    );
                  }

                  let subLabel = null;
                  let isSubPage = false;

                  if (stockProductCreate) {
                    subLabel = 'Add Product';
                    isSubPage = true;
                  } else if (stockBranch === 'categories') {
                    subLabel = 'Categories';
                    isSubPage = true;
                  } else if (stockBranch === 'subcategories') {
                    subLabel = 'Subcategories';
                    isSubPage = true;
                  } else if (stockBranch === 'brands') {
                    subLabel = 'Brands';
                    isSubPage = true;
                  } else if (stockBranch === 'products') {
                    subLabel = 'Products';
                    isSubPage = true;
                  } else if (stockBranch === 'movements') {
                    subLabel = 'Stock Movement';
                    isSubPage = true;
                  } else if (stockBranch === 'price-history') {
                    subLabel = 'Price History';
                    isSubPage = true;
                  }

                  if (isSubPage) {
                    return (
                      <>
                        <a
                          href="/stocks"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              setStockProductCreate?.(false);
                              setStockBranch?.('overview');
                              navigate('/stocks');
                            }
                          }}
                        >
                          Stocks
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">{subLabel}</span>
                      </>
                    );
                  }

                  return <span className="breadcrumb-current">Stocks</span>;
                })()
              ) : activeTab === 'delivery-challans' ? (
                (() => {
                  const subLabels = {
                    overview: 'Overview',
                    new: 'New Delivery Challan',
                    history: 'DC History',
                    dispatch: 'DC Dispatch',
                    receive: 'DC Receive',
                    return: 'Return DC',
                    'return-new': 'Initiate Return'
                  };
                  const currentSub = dcSubView || 'overview';
                  if (activeDocId) {
                    return (
                      <>
                        <a
                          href="/delivery-challans"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/delivery-challans');
                            }
                          }}
                        >
                          Delivery Challans
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">{activeDocId}</span>
                      </>
                    );
                  }
                  if (currentSub === 'return-new') {
                    return (
                      <>
                        <a
                          href="/delivery-challans"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/delivery-challans');
                            }
                          }}
                        >
                          Delivery Challans
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <a
                          href="/delivery-challans/return"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/delivery-challans/return');
                            }
                          }}
                        >
                          Return DC
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">Initiate Return</span>
                      </>
                    );
                  }
                  if (currentSub !== 'overview') {
                    return (
                      <>
                        <a
                          href="/delivery-challans"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/delivery-challans');
                            }
                          }}
                        >
                          Delivery Challans
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">{subLabels[currentSub] || currentSub}</span>
                      </>
                    );
                  }
                  return <span className="breadcrumb-current">Delivery Challans</span>;
                })()
              ) : activeTab === 'purchase-orders' ? (
                (() => {
                  const subLabels = {
                    overview: 'Overview',
                    new: 'Create PO',
                    sent: 'Sent Orders to Supplier',
                    receive: 'Receive Goods',
                    suppliers: 'Suppliers',
                    history: 'PO History'
                  };
                  const currentSub = poSubView || 'overview';
                  if (currentSub === 'supplier-detail') {
                    return (
                      <>
                        <a
                          href="/purchase-orders"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/purchase-orders');
                            }
                          }}
                        >
                          Purchase Orders
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <a
                          href="/purchase-orders/suppliers"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/purchase-orders/suppliers');
                            }
                          }}
                        >
                          Suppliers
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">Supplier History</span>
                      </>
                    );
                  }
                  if (activePoId) {
                    if (currentSub === 'receive' || currentSub === 'receive-po') {
                      return (
                        <>
                          <a
                            href="/purchase-orders"
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate('/purchase-orders');
                              }
                            }}
                          >
                            Purchase Orders
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <a
                            href={`/purchase-orders/${activePoId}`}
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate(`/purchase-orders/${activePoId}`);
                              }
                            }}
                          >
                            {activePoId}
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <span className="breadcrumb-current">Receive Goods</span>
                        </>
                      );
                    }
                    if (currentSub === 'edit') {
                      return (
                        <>
                          <a
                            href="/purchase-orders"
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate('/purchase-orders');
                              }
                            }}
                          >
                            Purchase Orders
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <a
                            href={`/purchase-orders/${activePoId}`}
                            className="breadcrumb-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate(`/purchase-orders/${activePoId}`);
                              }
                            }}
                          >
                            {activePoId}
                          </a>
                          <span className="breadcrumb-sep">/</span>
                          <span className="breadcrumb-current">Edit PO</span>
                        </>
                      );
                    }
                    return (
                      <>
                        <a
                          href="/purchase-orders"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/purchase-orders');
                            }
                          }}
                        >
                          Purchase Orders
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">{activePoId}</span>
                      </>
                    );
                  }
                  if (currentSub !== 'overview') {
                    return (
                      <>
                        <a
                          href="/purchase-orders"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/purchase-orders');
                            }
                          }}
                        >
                          Purchase Orders
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        <span className="breadcrumb-current">{subLabels[currentSub] || currentSub}</span>
                      </>
                    );
                  }
                  return <span className="breadcrumb-current">Purchase Orders</span>;
                })()
              ) : activeTab === 'orders' ? (
                (() => {
                  if (ordersSubView === 'proformas') {
                    return (
                      <>
                        <a
                          href="/orders"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/orders');
                            }
                          }}
                        >
                          Orders &amp; Deals
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        {activeDocId ? (
                          <>
                            <a
                              href="/orders/proformas"
                              className="breadcrumb-link"
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                  e.preventDefault();
                                  navigate('/orders/proformas');
                                }
                              }}
                            >
                              Proforma
                            </a>
                            <span className="breadcrumb-sep">/</span>
                            <span className="breadcrumb-current">{activeDocId}</span>
                          </>
                        ) : (
                          <span className="breadcrumb-current">Proforma</span>
                        )}
                      </>
                    );
                  }
                  if (ordersSubView === 'invoices') {
                    return (
                      <>
                        <a
                          href="/orders"
                          className="breadcrumb-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate('/orders');
                            }
                          }}
                        >
                          Orders &amp; Deals
                        </a>
                        <span className="breadcrumb-sep">/</span>
                        {activeDocId ? (
                          <>
                            <a
                              href="/orders/invoices"
                              className="breadcrumb-link"
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                  e.preventDefault();
                                  navigate('/orders/invoices');
                                }
                              }}
                            >
                              Invoices
                            </a>
                            <span className="breadcrumb-sep">/</span>
                            <span className="breadcrumb-current">{activeDocId}</span>
                          </>
                        ) : (
                          <span className="breadcrumb-current">Invoices</span>
                        )}
                      </>
                    );
                  }
                  return <span className="breadcrumb-current">Orders &amp; Deals</span>;
                })()
              ) : (
                <span className="breadcrumb-current">
                  {activeTab === 'enquiries' && 'Enquiry Management'}
                  {activeTab === 'customers' && 'Customer Directory'}
                  {activeTab === 'quotations' && 'Quotations'}
                  {activeTab === 'settings' && 'Settings'}
                </span>
              )}
            </div>
          </div>

            <div className={`topbar-right ${activeTab === 'enquiries' ? 'enquiries-topbar-right' : ''}`}>
            {(canCreateEnquiry || (canViewEnquiries && hasPermission(user, 'Quotations', 'Create'))) && (
              <button
                onClick={() => onNavigateToCreate && onNavigateToCreate()}
                className="topbar-create-btn"
              >
                {canCreateEnquiry ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M8 9h8M8 13h8M8 17h5" />
                  </svg>
                )}
                <span>{primaryActionLabel || (canCreateEnquiry ? 'Create Enquiry' : 'Enquiry Queue')}</span>
              </button>
            )}

            {canOpenSettings && (
              <a
                href="/settings"
                onClick={(e) => {
                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    onNavigateToSettings();
                  }
                }}
                className="topbar-settings-btn"
                title="Settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.5 1.5-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V22h-2.12v-.4a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.5-1.5.06-.06A1.7 1.7 0 0 0 9.2 15a1.7 1.7 0 0 0-1.56-1.03H7.2v-2.12h.44A1.7 1.7 0 0 0 9.2 10.82a1.7 1.7 0 0 0-.34-1.88L8.8 8.88l1.5-1.5.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 13.27 6.2V5.8h2.12v.44a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.5 1.5-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.44v2.12h-.44A1.7 1.7 0 0 0 19.4 15Z" />
                </svg>
                <span>Settings</span>
              </a>
            )}
          </div>
        </header>

        {/* VIEWPORT BODY */}
        <main className="crm-content-area">
          {children}
        </main>
      </div>
    </div>
  );
}
