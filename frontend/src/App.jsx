import React, { useState, useRef, useEffect, Component } from 'react'
import './App.css'
import CrmLayout from './components/layout/CrmLayout'
import EnquiryList from './components/enquiry/EnquiryList'
import CreateEnquiry from './components/enquiry/CreateEnquiry'
import EnquiryDetails from './components/enquiry/EnquiryDetails'
import FollowUpView from './components/enquiry/FollowUpView'
import QuotationView from './components/enquiry/QuotationView'
import QuotationsList from './components/enquiry/QuotationsList'
import NewQuotationPage from './components/enquiry/NewQuotationPage'
import QuotationEditor from './components/enquiry/QuotationEditor'
import EnquiryQueueHome from './components/enquiry/EnquiryQueueHome'
import CaseSolvedView from './components/enquiry/CaseSolvedView'
import CustomerList from './components/customer/CustomerList'
import CustomerDetail from './components/customer/CustomerDetail'
import OrdersView from './components/orders/OrdersView'
import SettingsPage from './components/settings/SettingsPage'
import StockPage, { ProductInfoPage, ProductPriceHistoryPage } from './components/stocks/StockPage'
import StockMovementPage from './components/stocks/StockMovementPage'
import ProductCreatePage from './components/stocks/ProductCreatePage'
import DeliveryChallansView from './components/deliveryChallans/DeliveryChallansView'
import PurchaseOrdersView from './components/purchaseOrders/PurchaseOrdersView'
import CreatePurchaseOrder from './components/purchaseOrders/CreatePurchaseOrder'
import PurchaseOrderDetail from './components/purchaseOrders/PurchaseOrderDetail'
import ReceiveGoodsView from './components/purchaseOrders/ReceiveGoodsView'
import PurchaseOrderHistory from './components/purchaseOrders/PurchaseOrderHistory'
import SupplierDetail from './components/purchaseOrders/SupplierDetail'
import SuppliersRegister from './components/purchaseOrders/SuppliersRegister'
import SentItemsToSupplierView from './components/purchaseOrders/SentItemsToSupplierView'
import FinanceView from './components/finance/FinanceView'
import SerialTrackingView from './components/serials/SerialTrackingView'
import WarehouseView from './components/warehouse/WarehouseView'
import { apiFetch, apiUrl } from './api'
import { hasAnyPermission, hasPermission } from './utils/permissions'
import { parseRoute, navigate } from './router'
import { fetchCompanyConfig } from './components/documents/companyConfig'

const BACKEND_API_URL = apiUrl('/api/auth')

export default function App() {
  const [routeState, setRouteState] = useState(() => ({
    ...parseRoute(),
    navigationState: typeof window !== 'undefined' ? window.history.state : null
  }))
  const activeTab = routeState.activeTab
  const enquirySubView = routeState.enquirySubView || 'list'
  const ordersSubView = routeState.ordersSubView || 'orders'
  const activeDocId = routeState.activeDocId || null
  const docType = routeState.docType || null
  const dcSubView = routeState.dcSubView || 'overview'
  const activeDcId = routeState.activeDcId || null
  const poSubView = routeState.poSubView || 'overview'
  const activePoId = routeState.activePoId || null
  const quotationSubView = routeState.quotationSubView || 'list'
  const activeQuotationId = routeState.activeQuotationId || null
  const financeSubView = routeState.financeSubView || 'overview'
  const activeEnquiryId = routeState.activeEnquiryId
  const activeCustomerId = routeState.activeCustomerId
  const stockBranch = routeState.stockBranch || 'overview'
  const stockProductCreate = Boolean(routeState.stockProductCreate)
  const stockProductEdit = Boolean(routeState.stockProductEdit)
  const stockProductPriceHistory = Boolean(routeState.stockProductPriceHistory)
  const stockProductMovements = Boolean(routeState.stockProductMovements)
  const activeProductId = routeState.activeProductId || null

  const [stockProductInfo, setStockProductInfo] = useState(null)
  const [preselectedCustForEnq, setPreselectedCustForEnq] = useState(null)

  // Enquiry Create Draft preservation across navigation (View Profile / Back / Load to Enquiry)
  const [enquiryCreateDraft, setEnquiryCreateDraft] = useState(() => {
    try {
      const saved = sessionStorage.getItem('asicrm_enquiry_create_draft')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const saveEnquiryDraft = (draftData) => {
    setEnquiryCreateDraft(draftData)
    try {
      if (draftData) {
        sessionStorage.setItem('asicrm_enquiry_create_draft', JSON.stringify(draftData))
      } else {
        sessionStorage.removeItem('asicrm_enquiry_create_draft')
      }
    } catch (e) {
      console.warn('Failed to save enquiry draft to sessionStorage:', e)
    }
  }

  const clearEnquiryDraft = () => {
    saveEnquiryDraft(null)
  }

  useEffect(() => {
    const initial = window.location.pathname + window.location.search;
    if (!initial.startsWith('/settings')) {
      sessionStorage.setItem('asicrm_last_module_path', initial);
    }

    const handleRouteChange = () => {
      const current = window.location.pathname + window.location.search;
      if (!current.startsWith('/settings')) {
        sessionStorage.setItem('asicrm_last_module_path', current);
      }
      setRouteState({
        ...parseRoute(current),
        navigationState: window.history.state
      });
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('app-route-change', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('app-route-change', handleRouteChange);
    };
  }, []);

  // Restore product details if returning from document navigation
  useEffect(() => {
    if (activeTab === 'stocks' && !stockProductInfo) {
      try {
        const restore = sessionStorage.getItem('asicrm_restore_product');
        if (restore) {
          const parsed = JSON.parse(restore);
          sessionStorage.removeItem('asicrm_restore_product');
          if (parsed && (parsed.id || parsed.code)) {
            setStockProductInfo(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to restore product context:', e);
      }
    }
  }, [activeTab, stockProductInfo]);
  // Authentication state (persisted in localStorage)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('asicrm_user')
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  })

  // Navigation steps: 'mobile' | 'otp'
  const [step, setStep] = useState('mobile')
  
  // Mobile form state (starts blank for clean, production login)
  const [mobile, setMobile] = useState('')
  
  // OTP form state (4 individual digits; backend generates a fresh random OTP when real SMS mode is enabled)
  const [otpDigits, setOtpDigits] = useState(['', '', '', ''])
  const otpInputRefs = useRef([])

  // OTP resend cooldown is driven by the backend response and shown as a live
  // countdown so the user always knows exactly when another OTP can be requested.
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(0)
  // Keep cooldowns associated with the mobile number that triggered them.
  // A different phone number must not inherit another number's cooldown.
  const [cooldownsByMobile, setCooldownsByMobile] = useState({})

  // Helpers
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [sessionHydrating, setSessionHydrating] = useState(true)

  // Refresh the persisted session from the backend on every app load.
  // This keeps role assignments and permission changes immediately in sync
  // without requiring the user to log out/in after an admin updates RBAC.
  useEffect(() => {
    let active = true
    const hydrateSession = async () => {
      if (!user?.mobile) {
        if (active) setSessionHydrating(false)
        return
      }
      try {
        const response = await apiFetch(apiUrl('/api/settings/resolve-user'))
        const data = await response.json()
        if (response.ok && data.success && data.data) {
          const nextUser = { ...data.data, loggedInAt: user.loggedInAt || new Date().toISOString() }
          setUser(nextUser)
          localStorage.setItem('asicrm_user', JSON.stringify(nextUser))
          fetchCompanyConfig(nextUser)
        } else if (response.status === 401) {
          localStorage.removeItem('asicrm_user')
          setUser(null)
        }
      } catch (error) {
        console.warn('Session permission refresh failed:', error)
      } finally {
        if (active) setSessionHydrating(false)
      }
    }
    hydrateSession()
    return () => { active = false }
  }, [])

  // Keep the resend countdown synchronized with wall-clock time.
  // The backend is authoritative; this is the user-facing countdown/disable state.
  const currentCooldownEndAt = mobile ? Number(cooldownsByMobile[mobile] || 0) : 0

  useEffect(() => {
    const updateCountdown = () => {
      if (!mobile || !currentCooldownEndAt) {
        setResendRemainingSeconds(0)
        return
      }

      const remaining = Math.max(0, Math.ceil((currentCooldownEndAt - Date.now()) / 1000))
      setResendRemainingSeconds(remaining)

      if (remaining === 0) {
        setCooldownsByMobile((current) => {
          if (current[mobile] !== currentCooldownEndAt) return current
          const next = { ...current }
          delete next[mobile]
          return next
        })
      }
    }

    updateCountdown()
    const timerId = window.setInterval(updateCountdown, 250)
    return () => window.clearInterval(timerId)
  }, [mobile, currentCooldownEndAt])

  const formatCountdown = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds) || 0)
    const minutes = Math.floor(safeSeconds / 60)
    const secs = safeSeconds % 60
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  const startResendCooldown = (seconds, targetMobile = mobile) => {
    const safeSeconds = Math.max(0, Number(seconds) || 90)
    if (!targetMobile) return
    const endAt = Date.now() + safeSeconds * 1000
    setCooldownsByMobile((current) => ({ ...current, [targetMobile]: endAt }))
  }

  // Handle Mobile input: digits only, max 10 digits
  const handleMobileChange = (e) => {
    const rawValue = e.target.value
    // Strip everything that is not a digit
    const cleaned = rawValue.replace(/\D/g, '').slice(0, 10)
    setMobile(cleaned)
    setErrorMsg('')
  }

  // Send OTP handler (Secure: NO OTP EXPOSURE)
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    if (mobile.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.')
      return
    }
    if (resendRemainingSeconds > 0) {
      setErrorMsg('')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const response = await fetch(`${BACKEND_API_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        // Non-JSON response
      }

      if (response.ok && data?.success) {
        setStep('otp')
        setOtpDigits(['', '', '', ''])
        setSuccessMsg(data?.message || `OTP sent to +91 ${mobile}`)
        startResendCooldown(data?.resendCooldownSeconds || 90)
        
        setTimeout(() => {
          if (otpInputRefs.current[0]) {
            otpInputRefs.current[0].focus()
          }
        }, 100)
      } else {
        const retryAfterSeconds = Number(data?.retryAfterSeconds)
        if (response.status === 429 && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
          startResendCooldown(retryAfterSeconds, mobile)
          setErrorMsg('')
        } else {
          setErrorMsg(data?.message || 'Failed to send OTP. Please try again.')
        }
      }
    } catch (err) {
      console.error('Send OTP Error:', err)
      setErrorMsg('Unable to connect to server. Please check your network connection or try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle individual OTP digit changes (4 digits)
  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = digit
    setOtpDigits(newDigits)
    setErrorMsg('')

    // Move focus to next input if digit entered
    if (digit && index < 3 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1].focus()
    }
  }

  // Handle backspace navigation in OTP boxes
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0 && otpInputRefs.current[index - 1]) {
      otpInputRefs.current[index - 1].focus()
    }
  }

  // Handle paste in OTP boxes (4 digits)
  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pastedData) {
      const newDigits = ['', '', '', '']
      for (let i = 0; i < 4; i++) {
        newDigits[i] = pastedData[i] || ''
      }
      setOtpDigits(newDigits)
      // Focus appropriate box
      const nextIndex = Math.min(pastedData.length, 3)
      if (otpInputRefs.current[nextIndex]) {
        otpInputRefs.current[nextIndex].focus()
      }
    }
  }

  // Verify OTP handler (4 digits)
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault()
    const fullOtp = otpDigits.join('')

    if (fullOtp.length !== 4) {
      setErrorMsg('Please enter the complete 4-digit OTP.')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const response = await fetch(`${BACKEND_API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: fullOtp })
      })

      let data = null
      try {
        data = await response.json()
      } catch {
        // Non-JSON response
      }

      if (response.ok && data?.success && data?.user) {
        const authUser = { ...data.user, loggedInAt: new Date().toISOString() }
        setUser(authUser)
        localStorage.setItem('asicrm_user', JSON.stringify(authUser))
      } else {
        setErrorMsg(data?.message || 'Invalid OTP. Please check the 4-digit code.')
      }
    } catch (err) {
      console.error('Verify OTP Error:', err)
      setErrorMsg('Unable to connect to server. Please check your network connection or try again.')
    } finally {
      setLoading(false)
    }
  }

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('asicrm_user')
    setUser(null)
    setPreselectedCustForEnq(null)
    setStep('mobile')
    setMobile('')
    setOtpDigits(['', '', '', ''])
    setResendRemainingSeconds(0)
    setCooldownsByMobile({})
    setErrorMsg('')
    setSuccessMsg('')
    navigate('/')
  }

  // Change mobile number / return to Step 1
  const handleChangeNumber = () => {
    setStep('mobile')
    setErrorMsg('')
    setSuccessMsg('')
    setOtpDigits(['', '', '', ''])
  }

  // Format masked mobile number: e.g. +91 99941 26686
  const formatMaskedMobile = (num) => {
    if (!num) return ''
    if (num.length === 10) {
      return `+91 ${num.slice(0, 5)} ${num.slice(5)}`
    }
    return `+91 ${num}`
  }

  // =========================================================================
  // AUTHENTICATED VIEW: /home
  // =========================================================================
  if (user && sessionHydrating) {
    return (
      <div className="crm-loading-full" style={{ minHeight: '100vh' }}>
        <div className="crm-spinner" />
        <p>Refreshing your access permissions…</p>
      </div>
    )
  }

  if (user) {
    return (
      <CrmErrorBoundary>
        <CrmDashboard
          user={user}
          onLogout={handleLogout}
          activeTab={activeTab}
          enquirySubView={enquirySubView}
          ordersSubView={ordersSubView}
          activeDocId={activeDocId}
          docType={docType}
          dcSubView={dcSubView}
          activeDcId={activeDcId}
          poSubView={poSubView}
          activePoId={activePoId}
          routeState={routeState}
          activeGrnId={routeState.activeGrnId}
          targetGrnId={routeState.targetGrnId}
          quotationSubView={quotationSubView}
          activeQuotationId={activeQuotationId}
          activeEnquiryId={activeEnquiryId}
          activeCustomerId={activeCustomerId}
          navigationState={routeState.navigationState}
          enquiryCreateDraft={enquiryCreateDraft}
          onSaveEnquiryDraft={saveEnquiryDraft}
          onClearEnquiryDraft={clearEnquiryDraft}
          stockBranch={stockBranch}
          stockProductCreate={stockProductCreate}
          stockProductEdit={stockProductEdit}
          stockProductPriceHistory={stockProductPriceHistory}
          stockProductMovements={stockProductMovements}
          activeProductId={activeProductId}
          stockProductInfo={stockProductInfo}
          setStockProductInfo={setStockProductInfo}
          preselectedCustForEnq={preselectedCustForEnq}
          setPreselectedCustForEnq={setPreselectedCustForEnq}
        />
      </CrmErrorBoundary>
    );
  }

  if (false && user) {
    return (
      <div className="home-page-container">
        {/* Navigation Bar */}
        <header className="home-navbar">
          <div className="home-nav-brand">
            <div className="brand-logo-icon mini">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-svg">
                <path
                  d="M24 4L8 10V22C8 32.5 14.8 42.2 24 44C33.2 42.2 40 32.5 40 22V10L24 4Z"
                  fill="url(#homeShieldGrad)"
                />
                <path
                  d="M17 23.5L22 28.5L31 18.5"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="homeShieldGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="0.5" stopColor="#2563eb" />
                    <stop offset="1" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="home-brand-title">ASICRM</span>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </header>

        {/* Home Main Content */}
        <main className="home-main-content">
          <div className="home-welcome-card">
            <div className="welcome-avatar-circle">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1657ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div className="verification-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Authenticated via Mobile OTP</span>
            </div>

            <h1 className="home-title">Welcome User</h1>
            <p className="home-mobile-display">
              Mobile: <strong>+91 {user.mobile}</strong>
            </p>

            <div className="home-card-divider" />

            <div className="home-info-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1657ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Your session is secure. You can log out anytime to test the authentication flow again.</span>
            </div>

            <button onClick={handleLogout} className="home-logout-cta">
              Logout
            </button>
          </div>
        </main>
      </div>
    )
  }

  // =========================================================================
  // UNAUTHENTICATED VIEW: ASICRM LOGIN (Mobile + OTP)
  // =========================================================================
  return (
    <div className="login-page-container">
      {/* LEFT COLUMN: HERO BANNER */}
      <section className="left-hero-section">
        {/* Background Dot Pattern & Ambient Glows */}
        <div className="dot-pattern-overlay" aria-hidden="true" />
        <div className="ambient-glow glow-top" aria-hidden="true" />
        <div className="ambient-glow glow-bottom" aria-hidden="true" />

        {/* Decorative corner dot cluster */}
        <div className="corner-dots" aria-hidden="true">
          <span /><span /><span /><br />
          <span /><span /><span /><br />
          <span /><span /><span />
        </div>

        <div className="left-content-wrapper">
          {/* Top Brand Logo */}
          <header className="brand-header">
            <div className="brand-logo-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-svg">
                <defs>
                  <linearGradient id="shieldGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="0.5" stopColor="#2563eb" />
                    <stop offset="1" stopColor="#1d4ed8" />
                  </linearGradient>
                  <linearGradient id="checkGrad" x1="16" y1="20" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ffffff" />
                    <stop offset="1" stopColor="#e0f2fe" />
                  </linearGradient>
                  <filter id="logoShadow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0c2d82" floodOpacity="0.4" />
                  </filter>
                </defs>
                <path
                  d="M24 4L8 10V22C8 32.5 14.8 42.2 24 44C33.2 42.2 40 32.5 40 22V10L24 4Z"
                  fill="url(#shieldGrad)"
                  filter="url(#logoShadow)"
                />
                <path
                  d="M17 23.5L22 28.5L31 18.5"
                  stroke="url(#checkGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">ASICRM</span>
              <span className="brand-subtitle">CRM Management Platform</span>
            </div>
          </header>

          {/* Marketing Headings */}
          <div className="hero-text-block">
            <h1 className="hero-heading">
              Manage Smarter.<br />
              <span className="hero-highlight">Grow Faster.</span>
            </h1>
            <div className="hero-pill-divider" />
            <p className="hero-description">
              Manage customers, leads and business operations from one powerful platform.
            </p>
          </div>

          {/* Large Hero CRM Illustration with Floating Cards */}
          <div className="hero-illustration-area" aria-hidden="true">
            {/* Floating Card 1: Lead notification */}
            <div className="floating-card float-left-card">
              <div className="card-icon blue-bg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <polyline points="16 11 18 13 22 9" />
                </svg>
              </div>
              <div className="card-lines">
                <div className="card-line-top">
                  <span className="lead-tag">New Lead</span>
                  <span className="lead-val">+24%</span>
                </div>
                <div className="line-placeholder short" />
              </div>
            </div>

            {/* Floating Card 2: Glassmorphic deals metric */}
            <div className="floating-card float-right-glass">
              <div className="glass-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="glass-content">
                <div className="line-placeholder bar" />
                <div className="line-placeholder bar short" />
              </div>
            </div>

            {/* Central 3D CRM Shield & Bell Artwork */}
            <div className="central-artwork-container">
              <svg className="central-shield-svg" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="bellGlow" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#2563eb" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity="1" />
                  </radialGradient>
                  <linearGradient id="shieldFront" x1="40" y1="50" x2="180" y2="200" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="0.6" stopColor="#2563eb" />
                    <stop offset="1" stopColor="#1e40af" />
                  </linearGradient>
                  <filter id="artShadow" x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#091e42" floodOpacity="0.5" />
                  </filter>
                </defs>
                <ellipse cx="100" cy="115" rx="70" ry="75" fill="url(#bellGlow)" filter="url(#artShadow)" />
                <path d="M50 145 C50 145, 60 170, 100 170 C140 170, 150 145, 150 145 Z" fill="#1e40af" opacity="0.6" />
                <path
                  d="M130 55 L75 75 V125 C75 162 105 195 130 205 C155 195 185 162 185 125 V75 L130 55 Z"
                  fill="url(#shieldFront)"
                  stroke="#93c5fd"
                  strokeWidth="2.5"
                />
                <path
                  d="M102 128 L122 148 L160 106"
                  stroke="#ffffff"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Floating Card 3: Notification Badge bottom right */}
            <div className="floating-card float-bottom-envelope">
              <div className="envelope-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span className="unread-dot">3</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT COLUMN: AUTHENTICATION CARD */}
      <section className="right-login-section">
        <div className="login-card-inner">
          {/* Top Emblem */}
          <div className="form-brand-badge">
            <div className="form-brand-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="badge-svg">
                <path
                  d="M24 4L8 10V22C8 32.5 14.8 42.2 24 44C33.2 42.2 40 32.5 40 22V10L24 4Z"
                  fill="url(#shieldGrad)"
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
          </div>

          {/* Error Message Toast/Alert */}
          {errorMsg && (
            <div className="auth-alert error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message Toast/Alert */}
          {successMsg && !errorMsg && (
            <div className="auth-alert success" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* =================================================================
              STEP 1: MOBILE NUMBER FORM
             ================================================================= */}
          {step === 'mobile' ? (
            <>
              <div className="form-header">
                <h2 className="form-title">Welcome Back</h2>
                <p className="form-subtitle">Enter your registered mobile number</p>
              </div>

              <form onSubmit={handleSendOtp} className="login-form">
                <div className="form-group">
                  <label htmlFor="mobileInput" className="input-label">
                    Mobile Number
                  </label>
                  <div className="phone-input-group">
                    {/* Country code prefix */}
                    <div className="country-code-pill" aria-label="India Country Code">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="phone-icon">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span className="code-text">+91</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chevron-icon">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>

                    <div className="phone-divider" />

                    {/* 10-digit number input */}
                    <input
                      id="mobileInput"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      className="phone-number-input"
                      placeholder="Enter 10-digit mobile number"
                      value={mobile}
                      onChange={handleMobileChange}
                      autoFocus
                      required
                    />

                    {mobile.length > 0 && (
                      <span className="digit-counter" aria-live="polite">
                        {mobile.length}/10
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile-page resend cooldown: keep Send OTP visibly disabled until the backend cooldown ends. */}
                {mobile.length === 10 && resendRemainingSeconds > 0 && (
                  <div className="mobile-otp-cooldown" role="status" aria-live="polite">
                    <span>You can request another OTP in</span>
                    <strong>{formatCountdown(resendRemainingSeconds)}</strong>
                  </div>
                )}

                {/* Send OTP Button (Only active when exactly 10 digits are present and cooldown has ended) */}
                <button
                  type="submit"
                  disabled={mobile.length !== 10 || loading || resendRemainingSeconds > 0}
                  className="submit-sign-in-btn"
                  aria-disabled={mobile.length !== 10 || loading || resendRemainingSeconds > 0}
                >
                  {loading ? (
                    <span>Sending OTP...</span>
                  ) : (
                    <>
                      <span>Send OTP</span>
                      <svg className="btn-arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Secure Login Divider */}
              <div className="secure-divider">
                <span className="divider-line" />
                <div className="divider-content">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Secure Login</span>
                </div>
                <span className="divider-line" />
              </div>

              {/* Footer Security Note */}
              <footer className="form-security-footer">
                <div className="security-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1657ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <p className="security-text">
                  Your information is protected with <a href="#privacy" onClick={(e) => e.preventDefault()}>secure access</a>.
                </p>
              </footer>
            </>
          ) : (
            /* =================================================================
               STEP 2: OTP VERIFICATION FORM
               ================================================================= */
            <>
              <div className="form-header">
                <h2 className="form-title">Verify OTP</h2>
                <p className="form-subtitle">
                  Enter the 4-digit code sent to
                </p>
                <div className="otp-target-row">
                  <span className="target-number">{formatMaskedMobile(mobile)}</span>
                  <button
                    type="button"
                    onClick={handleChangeNumber}
                    className="change-number-link"
                    title="Change mobile number"
                    aria-label="Change mobile number"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleVerifyOtp} className="login-form">
                <div className="form-group">
                  <label className="input-label centered" style={{ display: 'block', textAlign: 'center', marginBottom: '12px' }}>
                    Enter 4-Digit Security Code
                  </label>
                  
                  {/* 4-box OTP Input Group */}
                  <div className="otp-boxes-container" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        className={`otp-digit-box ${digit ? 'filled' : ''}`}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoComplete="one-time-code"
                        required
                      />
                    ))}
                  </div>
                </div>

                {/* Verify OTP Button */}
                <button
                  type="submit"
                  disabled={otpDigits.join('').length !== 4 || loading}
                  className="submit-sign-in-btn"
                >
                  {loading ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <span>Verify OTP</span>
                      <svg className="btn-arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Resend OTP Section: frontend countdown + backend enforcement */}
              <div className="resend-otp-section">
                <span className="resend-text">Didn&apos;t receive the code?</span>
                {resendRemainingSeconds > 0 ? (
                  <span className="resend-countdown-text">
                    Resend in <strong>{formatCountdown(resendRemainingSeconds)}</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="resend-active-btn"
                    aria-label="Resend OTP"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              {/* Secure Login Divider */}
              <div className="secure-divider">
                <span className="divider-line" />
                <div className="divider-content">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Secure Login</span>
                </div>
                <span className="divider-line" />
              </div>

              {/* Footer Security Note */}
              <footer className="form-security-footer">
                <div className="security-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1657ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <p className="security-text">
                  Your information is protected with <a href="#privacy" onClick={(e) => e.preventDefault()}>secure access</a>.
                </p>
              </footer>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

class CrmErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleRouteReset = () => {
      if (this.state.hasError) {
        this.setState({ hasError: false, error: null });
      }
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('CRM Render Error caught by Boundary:', error, info);
  }

  componentDidMount() {
    window.addEventListener('popstate', this.handleRouteReset);
    window.addEventListener('app-route-change', this.handleRouteReset);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleRouteReset);
    window.removeEventListener('app-route-change', this.handleRouteReset);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && (prevProps.resetKey !== this.props.resetKey || prevProps.children !== this.props.children)) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', maxWidth: '750px', margin: '40px auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #fed7aa', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#c2410c', marginBottom: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Module Render Error</h2>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px 0' }}>
            An unexpected error occurred while rendering <strong>{window.location.pathname}</strong>:
          </p>
          <pre style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', color: '#991b1b', fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap', margin: '0 0 20px 0' }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            >
              Reload Page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); navigate('/purchase-orders'); }}
              style={{ padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
            >
              Back to Overview
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CrmDashboard({
  user, onLogout, activeTab, enquirySubView, ordersSubView,
  activeDocId, docType, dcSubView = 'overview', activeDcId = null,
  poSubView = 'overview', activePoId = null,
  routeState = {}, activeGrnId = null, targetGrnId = null,
  quotationSubView = 'list', activeQuotationId = null,
  activeEnquiryId, activeCustomerId,
  navigationState, enquiryCreateDraft, onSaveEnquiryDraft, onClearEnquiryDraft,
  stockBranch, stockProductCreate, stockProductEdit = false, stockProductPriceHistory = false, stockProductMovements = false, activeProductId = null,
  stockProductInfo, setStockProductInfo,
  preselectedCustForEnq, setPreselectedCustForEnq
}) {
  const activeSupplierId = routeState?.activeSupplierId || null;
  const openCreateEnquiry = (customerId = null) => {
    setPreselectedCustForEnq(customerId);
    navigate('/enquiries/create');
  };
  const canCreateEnquiry = hasPermission(user, 'Enquiries', 'Create');
  const canViewEnquiries = hasPermission(user, 'Enquiries', 'View');
  const canPrepareQuotation = hasPermission(user, 'Quotations', 'Create');

  const openEnquiryQueue = () => {
    if (!canViewEnquiries || !canPrepareQuotation) return;
    navigate('/enquiries/queue');
  };

  const primaryEnquiryAction = () => {
    if (canCreateEnquiry) {
      openCreateEnquiry();
      return;
    }
    if (canViewEnquiries && canPrepareQuotation) {
      openEnquiryQueue();
      return;
    }
    if (canViewEnquiries) goToEnquiryList();
  };

  const primaryEnquiryActionLabel = canCreateEnquiry
    ? 'Create Enquiry'
    : canPrepareQuotation
      ? 'Enquiry Queue'
      : 'Enquiries';

  const selectEnquiry = (enquiryId, view = 'details', navContext = null) => {
    const opts = navContext ? { state: navContext } : {};
    if (view === 'followup') {
      navigate(`/enquiries/${encodeURIComponent(enquiryId)}/followup`, opts);
    } else if (view === 'solved') {
      navigate(`/enquiries/${encodeURIComponent(enquiryId)}/solved`, opts);
    } else if (view === 'quotation') {
      navigate(`/enquiries/${encodeURIComponent(enquiryId)}/quotation`, opts);
    } else {
      navigate(`/enquiries/${encodeURIComponent(enquiryId)}`, opts);
    }
  };
  const openCustomer = (customerId, navContext = null) => {
    try {
      if (navContext) {
        sessionStorage.setItem('asicrm_customer_profile_origin', JSON.stringify(navContext));
      } else {
        sessionStorage.removeItem('asicrm_customer_profile_origin');
      }
    } catch {}
    const opts = navContext ? { state: navContext } : {};
    navigate(`/customers/${encodeURIComponent(customerId)}`, opts);
  };
  const handleSettingsBack = () => {
    try {
      const prev = sessionStorage.getItem('asicrm_last_module_path');
      if (prev && !prev.startsWith('/settings')) {
        navigate(prev);
        return;
      }
    } catch {}
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      window.history.back();
    } else {
      navigate('/enquiries');
    }
  };

  const openSettings = () => {
    if (!hasAnyPermission(user, [
      ['User Administration', 'View Users'],
      ['User Administration', 'Create Users'],
      ['User Administration', 'Edit Users'],
      ['User Administration', 'Manage Roles'],
      ['User Administration', 'Manage Permissions']
    ])) return;
    const current = window.location.pathname + window.location.search;
    if (!current.startsWith('/settings')) {
      sessionStorage.setItem('asicrm_last_module_path', current);
    }
    navigate('/settings');
  };
  const openQuotation = (enquiryId, quotationId) => {
    if (quotationId) {
      navigate(`/quotations/${encodeURIComponent(quotationId)}`);
    } else if (enquiryId) {
      navigate(`/enquiries/${encodeURIComponent(enquiryId)}/quotation`);
    } else {
      navigate('/quotations');
    }
  };
  const backToFollowUp = () => {
    if (activeEnquiryId) {
      navigate(`/enquiries/${encodeURIComponent(activeEnquiryId)}/followup`);
    } else {
      navigate('/enquiries');
    }
  };
  const goToEnquiryList = () => {
    navigate('/enquiries');
  };

  // Handler when Customer Profile triggers "Load to Enquiry" / "Use Customer in Enquiry"
  const handleLoadCustomerToEnquiry = (customer) => {
    if (!customer) return;
    try { sessionStorage.removeItem('asicrm_customer_profile_origin'); } catch {}
    const nextDraft = {
      ...(enquiryCreateDraft || {}),
      customerMode: 'existing',
      customerId: customer.id,
      customerData: customer,
      branches: Array.isArray(customer.branches) ? customer.branches : []
    };
    onSaveEnquiryDraft(nextDraft);
    setPreselectedCustForEnq(customer.id);
    navigate('/enquiries/create');
  };

  const handleSetStockBranch = (branch, options = {}) => {
    if (branch === 'overview') {
      navigate('/stocks', { state: options });
    } else {
      const search = (options.lowStockOnly || options.stockFilter === 'low')
        ? '?filter=low'
        : (options.stockFilter === 'healthy' ? '?filter=healthy' : '');
      navigate(`/stocks/${branch}${search}`, { state: options });
    }
  };

  const handleSetStockProductCreate = (create) => {
    if (create) {
      navigate('/stocks/products/new');
    } else {
      navigate('/stocks/products');
    }
  };

  let content;
  if (activeTab === 'settings') {
    if (hasAnyPermission(user, [
      ['User Administration', 'View Users'],
      ['User Administration', 'Create Users'],
      ['User Administration', 'Edit Users'],
      ['User Administration', 'Manage Roles'],
      ['User Administration', 'Manage Permissions']
    ])) {
      content = (
        <SettingsPage
          user={user}
          initialSection={routeState.settingsSection}
          onNavigateSection={(sec) => navigate(sec ? `/settings/${sec}` : '/settings')}
          onBack={handleSettingsBack}
        />
      );
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to access Settings.</p></div>;
    }
  } else if (activeTab === 'quotations') {
    if (hasPermission(user, 'Quotations', 'View')) {
      if ((quotationSubView === 'new' && activeEnquiryId) || (enquirySubView === 'quotation' && activeEnquiryId)) {
        content = (
          <QuotationEditor
            key={`quotation-enquiry-${activeEnquiryId}`}
            user={user}
            mode="enquiry"
            enquiryId={activeEnquiryId}
            onClosed={() => navigate('/quotations')}
            onBackToFollowUp={backToFollowUp}
            onNavigateCustomer={openCustomer}
          />
        );
      } else if (quotationSubView === 'new') {
        content = (
          <QuotationEditor
            key="quotation-direct-new"
            user={user}
            mode="direct"
            onClosed={() => navigate('/quotations')}
            onNavigateCustomer={openCustomer}
          />
        );
      } else if (quotationSubView === 'details' && activeQuotationId) {
        content = (
          <QuotationEditor
            key={`quotation-details-${activeQuotationId}`}
            user={user}
            mode="details"
            quotationId={activeQuotationId}
            onClosed={() => navigate('/quotations')}
            onBackToFollowUp={backToFollowUp}
            onNavigateCustomer={openCustomer}
          />
        );
      } else {
        content = (
          <QuotationsList
            user={user}
            onOpenQuotation={openQuotation}
            onNavigateCustomer={openCustomer}
          />
        );
      }
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Quotations.</p></div>;
    }
  } else if (activeTab === 'purchase-orders') {
    if (hasPermission(user, 'Purchase Orders', 'View')) {
      if (poSubView === 'new') {
        if (!hasPermission(user, 'Purchase Orders', 'Create')) {
          content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to create purchase orders.</p></div>;
        } else {
          content = (
            <CreatePurchaseOrder
              user={user}
              onClosed={() => navigate('/purchase-orders')}
              onSuccess={(newId) => navigate('/purchase-orders/sent')}
            />
          );
        }
      } else if (poSubView === 'edit' && activePoId) {
        if (!hasPermission(user, 'Purchase Orders', 'Edit')) {
          content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to edit purchase orders.</p></div>;
        } else {
          content = (
            <CreatePurchaseOrder
              user={user}
              editPoId={activePoId}
              onClosed={() => navigate(`/purchase-orders/${activePoId}`)}
              onSuccess={(savedId) => navigate(`/purchase-orders/${savedId}`)}
            />
          );
        }
      } else if (poSubView === 'sent') {
        content = (
          <SentItemsToSupplierView
            user={user}
            onOpenPo={(id) => navigate(`/purchase-orders/${id}`)}
            onOpenReceive={(id) => navigate(id ? `/purchase-orders/${id}/receive` : '/purchase-orders/receive')}
          />
        );
      } else if (poSubView === 'history') {
        content = (
          <PurchaseOrderHistory
            user={user}
            onOpenPo={(id) => navigate(`/purchase-orders/${id}`)}
          />
        );
      } else if (poSubView === 'supplier-detail' && (activeSupplierId || routeState?.activeSupplierId)) {
        content = (
          <SupplierDetail
            user={user}
            supplierId={activeSupplierId || routeState?.activeSupplierId}
            onBack={() => navigate('/purchase-orders/history')}
            onOpenPo={(id) => navigate(`/purchase-orders/${id}`)}
            onOpenGrn={(id) => navigate(`/purchase-orders/grn/${id}`)}
          />
        );
      } else if (poSubView === 'suppliers') {
        content = (
          <SuppliersRegister
            user={user}
            onSelectSupplier={(id) => navigate(`/purchase-orders/suppliers/${encodeURIComponent(id)}`)}
          />
        );
      } else if (poSubView === 'receive' || poSubView === 'receive-po') {
        if (!hasPermission(user, 'Purchase Orders', 'Receive Goods')) {
          content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to receive goods for purchase orders.</p></div>;
        } else {
          content = (
            <ReceiveGoodsView
              user={user}
              preselectedPoId={activePoId}
              onBack={() => navigate(activePoId ? `/purchase-orders/${activePoId}` : '/purchase-orders')}
              onComplete={() => navigate('/purchase-orders/history')}
            />
          );
        }
      } else if ((poSubView === 'details' && activePoId) || (poSubView === 'grn-details' && (activePoId || activeGrnId || routeState?.activeGrnId))) {
        content = (
          <PurchaseOrderDetail
            user={user}
            poId={activePoId}
            grnId={activeGrnId || routeState?.activeGrnId}
            targetGrnId={targetGrnId || routeState?.targetGrnId}
            onBack={() => navigate('/purchase-orders')}
            onOpenReceive={(id) => navigate(`/purchase-orders/${id}/receive`)}
          />
        );
      } else {
        content = (
          <PurchaseOrdersView
            user={user}
            onNavigateCreate={() => navigate('/purchase-orders/new')}
            onOpenPo={(id) => navigate(`/purchase-orders/${id}`)}
            onOpenReceive={(id) => navigate(id ? `/purchase-orders/${id}/receive` : '/purchase-orders/receive')}
          />
        );
      }
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Purchase Orders.</p></div>;
    }
  } else if (activeTab === 'customers') {
    if (hasPermission(user, 'Customers', 'View')) {
      const effectiveNav = navigationState || (() => {
        try {
          const raw = sessionStorage.getItem('asicrm_customer_profile_origin');
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })();
      content = activeCustomerId ? (
        <CustomerDetail
          user={user}
          customerId={activeCustomerId}
          navigationContext={effectiveNav}
          onLoadToEnquiry={handleLoadCustomerToEnquiry}
          onBack={() => {
            const effectiveOrigin = navigationState || (() => {
              try {
                const raw = sessionStorage.getItem('asicrm_customer_profile_origin');
                return raw ? JSON.parse(raw) : null;
              } catch { return null; }
            })();
            if (effectiveOrigin?.from === 'enquiry-create') {
              if (effectiveOrigin.customerId) {
                setPreselectedCustForEnq(effectiveOrigin.customerId);
              }
              try { sessionStorage.removeItem('asicrm_customer_profile_origin'); } catch {}
              navigate(effectiveOrigin.returnTo || '/enquiries/create');
            } else if (effectiveOrigin?.from === 'quotation') {
              const dest = effectiveOrigin?.returnTo || (effectiveOrigin?.enquiryId ? `/enquiries/${encodeURIComponent(effectiveOrigin.enquiryId)}/quotation` : '/quotations');
              try { sessionStorage.removeItem('asicrm_customer_profile_origin'); } catch {}
              navigate(dest);
            } else {
              try { sessionStorage.removeItem('asicrm_customer_profile_origin'); } catch {}
              navigate('/customers');
            }
          }}
          onBackToEnquiry={() => {
            const effectiveOrigin = navigationState || (() => {
              try {
                const raw = sessionStorage.getItem('asicrm_customer_profile_origin');
                return raw ? JSON.parse(raw) : null;
              } catch { return null; }
            })();
            const dest = effectiveOrigin?.returnTo || (effectiveOrigin?.enquiryId ? `/enquiries/${encodeURIComponent(effectiveOrigin.enquiryId)}` : '/enquiries');
            try { sessionStorage.removeItem('asicrm_customer_profile_origin'); } catch {}
            navigate(dest);
          }}
          onBackToQuotation={() => {
            const effectiveOrigin = navigationState || (() => {
              try {
                const raw = sessionStorage.getItem('asicrm_customer_profile_origin');
                return raw ? JSON.parse(raw) : null;
              } catch { return null; }
            })();
            const dest = effectiveOrigin?.returnTo || (effectiveOrigin?.enquiryId ? `/enquiries/${encodeURIComponent(effectiveOrigin.enquiryId)}/quotation` : '/quotations');
            try { sessionStorage.removeItem('asicrm_customer_profile_origin'); } catch {}
            navigate(dest);
          }}
          onCreateEnquiryForCustomer={openCreateEnquiry}
          onSelectEnquiry={(enqId, view) => {
            selectEnquiry(enqId, view, {
              from: 'customer-profile',
              returnTo: `/customers/${encodeURIComponent(activeCustomerId)}`,
              customerId: activeCustomerId,
              initialTab: 'enquiries',
              returnLabel: 'Back to Customer Profile'
            });
          }}
        />
      ) : <CustomerList user={user} onSelectCustomer={openCustomer} onCreateEnquiryForCustomer={openCreateEnquiry} />;
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Customers.</p></div>;
    }
  } else if (activeTab === 'orders') {
    if (hasPermission(user, 'Orders & Deals', 'View')) {
      content = <OrdersView user={user} initialSubView={ordersSubView} activeDocId={activeDocId} docType={docType} proformaCreate={routeState.proformaCreate} onSelectEnquiry={selectEnquiry} onNavigateCustomer={openCustomer} />;
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Orders &amp; Deals.</p></div>;
    }
  } else if (activeTab === 'stocks') {
    if (hasPermission(user, 'Stocks', 'View')) {
      if (stockProductMovements && activeProductId) {
        content = (
          <StockMovementPage
            user={user}
            productId={activeProductId}
            onBack={() => {
              navigate(`/stocks/products/${encodeURIComponent(activeProductId)}/edit`);
            }}
            onNavigateOverview={() => {
              navigate('/stocks/movements');
            }}
            onRefreshData={() => {}}
          />
        );
      } else if (stockProductPriceHistory) {
        content = (
          <ProductPriceHistoryPage
            productId={activeProductId}
            initialProduct={stockProductInfo?.id === activeProductId ? stockProductInfo : null}
            user={user}
            onBack={() => {
              if (activeProductId) {
                navigate(`/stocks/products/${encodeURIComponent(activeProductId)}`);
              } else {
                navigate('/stocks/products');
              }
            }}
          />
        );
      } else if (stockProductCreate || stockProductEdit || (activeProductId && !routeState?.targetMovementId && !(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('movement')))) {
        const handleProductReturn = () => {
          let returnTo = null;
          try {
            const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            returnTo = (sp && sp.get('returnTo')) || sessionStorage.getItem('asicrm_product_return');
            sessionStorage.removeItem('asicrm_product_return');
            sessionStorage.removeItem('asicrm_product_from');
          } catch {}
          navigate(returnTo || '/stocks/products');
        };
        const isEdit = !stockProductCreate && (stockProductEdit || Boolean(activeProductId));
        const canAct = isEdit
          ? (hasPermission(user, 'Stocks', 'Edit') || hasPermission(user, 'Stocks', 'Create'))
          : hasPermission(user, 'Stocks', 'Create');
        content = canAct
          ? (
            <ProductCreatePage
              mode={isEdit ? 'edit' : 'create'}
              productId={isEdit ? activeProductId : null}
              user={user}
              onCancel={handleProductReturn}
              onSuccess={handleProductReturn}
            />
          )
          : (
            <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}>
              <h3>Access Restricted</h3>
              <p>You do not have permission to {isEdit ? 'edit' : 'create'} products.</p>
            </div>
          );
      } else if (activeProductId || stockProductInfo) {
        const prodId = activeProductId || stockProductInfo?.id || stockProductInfo?.code;
        const initialMovementId = routeState?.targetMovementId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('movement') : null);
        content = (
          <ProductInfoPage
            productId={prodId}
            product={stockProductInfo?.id === activeProductId ? stockProductInfo : null}
            initialMovementId={initialMovementId}
            user={user}
            onBack={(target) => {
              setStockProductInfo(null);
              let returnTo = target;
              try {
                if (!returnTo) returnTo = sessionStorage.getItem('asicrm_product_return');
                sessionStorage.removeItem('asicrm_product_return');
                sessionStorage.removeItem('asicrm_product_from');
              } catch {}
              navigate(returnTo || '/stocks/products');
            }}
            onOpenPriceHistory={(prod) => {
              if (prod) setStockProductInfo(prod);
              navigate(`/stocks/products/${encodeURIComponent(prod?.id || prodId)}/price-history`);
            }}
          />
        );
      } else {
        content = (
          <StockPage
            user={user}
            branch={stockBranch}
            setBranch={handleSetStockBranch}
            onCreateProduct={() => navigate('/stocks/products/new')}
            onOpenProductInfo={(product) => {
              navigate(`/stocks/products/${encodeURIComponent(product.id)}/edit`);
            }}
            activeProductId={activeProductId}
          />
        );
      }
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Stocks &amp; Inventory.</p></div>;
    }
  } else if (activeTab === 'delivery-challans') {
    if (hasPermission(user, 'Delivery Challans', 'View')) {
      content = (
        <DeliveryChallansView
          user={user}
          dcSubView={dcSubView}
          activeDcId={activeDcId}
          onNavigateCustomer={openCustomer}
        />
      );
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Delivery Challans.</p></div>;
    }
  } else if (activeTab === 'serials' || activeTab === 'serial-tracking') {
    const canAccessSerials = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' ||
      String(user?.role || '').toUpperCase() === 'ADMIN' ||
      hasPermission(user, 'Stocks', 'View') ||
      hasPermission(user, 'Orders & Deals', 'View') ||
      hasPermission(user, 'Purchase Orders', 'View') ||
      hasPermission(user, 'Finance', 'View');

    if (canAccessSerials) {
      content = (
        <SerialTrackingView
          user={user}
          initialQuery={routeState.serialQuery || ''}
          initialStatus={routeState.serialStatus || 'ALL'}
        />
      );
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Serial Tracking.</p></div>;
    }
  } else if (activeTab === 'warehouses' || activeTab === 'warehouse') {
    const canAccessWarehouse = String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' ||
      String(user?.role || '').toUpperCase() === 'ADMIN' ||
      hasPermission(user, 'Stocks', 'View') ||
      hasPermission(user, 'Purchase Orders', 'View') ||
      hasPermission(user, 'Orders & Deals', 'View');

    if (canAccessWarehouse) {
      content = <WarehouseView user={user} />;
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Warehouse Facility.</p></div>;
    }
  } else if (activeTab === 'finance') {
    if (String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' || String(user?.role || '').toUpperCase() === 'ADMIN' || hasPermission(user, 'Finance', 'View')) {
      content = <FinanceView user={user} initialSubView={routeState.financeSubView} />;
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to view Finance &amp; Flow Control.</p></div>;
    }
  } else if (enquirySubView === 'create') {
    if (hasPermission(user, 'Enquiries', 'Create')) {
      content = (
        <CreateEnquiry
          user={user}
          preselectedCustomerId={preselectedCustForEnq}
          initialDraft={enquiryCreateDraft}
          onSaveDraft={onSaveEnquiryDraft}
          onClearDraft={onClearEnquiryDraft}
          onCancel={() => {
            const prevId = enquiryCreateDraft?.existingEnquiryId || enquiryCreateDraft?.enquiryId;
            onClearEnquiryDraft();
            if (prevId) {
              selectEnquiry(prevId, 'details');
            } else {
              goToEnquiryList();
            }
          }}
          onSuccess={(id) => {
            onClearEnquiryDraft();
            selectEnquiry(id, 'details');
          }}
          onNavigateCustomer={openCustomer}
        />
      );
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to create enquiries.</p></div>;
    }
  } else if (enquirySubView === 'details' && activeEnquiryId) {
    content = (
      <EnquiryDetails
        user={user}
        enquiryId={activeEnquiryId}
        navigationContext={navigationState}
        onProceedToFollowUp={(id) => selectEnquiry(id, 'followup')}
        onBackToList={() => {
          if (navigationState?.from === 'customer-profile' && navigationState.returnTo) {
            navigate(navigationState.returnTo, { state: { initialTab: navigationState.initialTab || 'enquiries' } });
          } else {
            goToEnquiryList();
          }
        }}
        onBackToPreviousStep={(enquiryData) => {
          if (enquiryData) {
            onSaveEnquiryDraft({
              customerMode: 'existing',
              customerId: enquiryData.customerId,
              customerData: {
                id: enquiryData.customerId,
                name: enquiryData.customerName,
                companyName: enquiryData.customerCompany,
                mobile: enquiryData.customerMobile,
                email: enquiryData.customerEmail
              },
              source: enquiryData.source,
              type: enquiryData.type,
              priority: enquiryData.priority,
              assignedTo: enquiryData.assignedTo,
              initialEnquiryDate: enquiryData.initialEnquiryDate || (enquiryData.createdAt ? enquiryData.createdAt.slice(0, 10) : ''),
              existingEnquiryId: enquiryData.enquiryId,
              enquiryId: enquiryData.enquiryId
            });
            setPreselectedCustForEnq(enquiryData.customerId);
          }
          navigate('/enquiries/create', { state: { from: 'enquiry-details', enquiryId: activeEnquiryId } });
        }}
        onNavigateCustomer={openCustomer}
      />
    );
  } else if (enquirySubView === 'followup' && activeEnquiryId) {
    if (hasPermission(user, 'Enquiries', 'Follow Up')) {
      content = <FollowUpView enquiryId={activeEnquiryId} onNavigateToQuotation={(id) => openQuotation(id)} onNavigateToClosed={(id) => selectEnquiry(id, 'solved')} onBackToDetails={() => selectEnquiry(activeEnquiryId, 'details')} onBackToList={goToEnquiryList} onNavigateCustomer={openCustomer} />;
    } else {
      content = <div className="crm-restricted-view" style={{ padding: '48px', textAlign: 'center' }}><h3>Access Restricted</h3><p>You do not have permission to follow up on enquiries.</p></div>;
    }
  } else if (enquirySubView === 'quotation' && activeEnquiryId) {
    content = (
      <QuotationEditor
        key={`quotation-enquiry-${activeEnquiryId}`}
        user={user}
        mode="enquiry"
        enquiryId={activeEnquiryId}
        onClosed={() => navigate('/quotations')}
        onBackToFollowUp={backToFollowUp}
        onNavigateCustomer={openCustomer}
      />
    );
  } else if (enquirySubView === 'solved' && activeEnquiryId) {
    content = <CaseSolvedView user={user} enquiryId={activeEnquiryId} onCancel={() => selectEnquiry(activeEnquiryId, 'followup')} onBackToList={goToEnquiryList} onNavigateCustomer={openCustomer} />;
  } else if (enquirySubView === 'queue') {
    content = <EnquiryQueueHome user={user} onPrepareQuotation={(id) => openQuotation(id)} onBack={goToEnquiryList} onNavigateCustomer={openCustomer} />;
  } else {
    content = <EnquiryList user={user} onSelectEnquiry={selectEnquiry} onCreateEnquiry={() => openCreateEnquiry()} onNavigateCustomer={openCustomer} />;
  }

  const setSafeActiveTab = (tab) => {
    if (tab === 'settings') {
      if (!hasAnyPermission(user, [
        ['User Administration', 'View Users'],
        ['User Administration', 'Create Users'],
        ['User Administration', 'Edit Users'],
        ['User Administration', 'Manage Roles'],
        ['User Administration', 'Manage Permissions']
      ])) return;
      navigate('/settings');
      return;
    }
    if (tab === 'stocks') {
      if (!hasPermission(user, 'Stocks', 'View')) return;
      if (['categories', 'subcategories', 'brands', 'products'].includes(stockBranch)) {
        navigate(`/stocks/${stockBranch}`);
      } else {
        navigate('/stocks');
      }
      return;
    }
    if (tab === 'orders') {
      if (!hasPermission(user, 'Orders & Deals', 'View')) return;
      navigate('/orders');
      return;
    }
    if (tab === 'delivery-challans') {
      if (!hasPermission(user, 'Delivery Challans', 'View')) return;
      navigate(dcSubView && dcSubView !== 'overview' ? `/delivery-challans/${dcSubView}` : '/delivery-challans');
      return;
    }
    if (tab === 'customers') {
      if (!hasPermission(user, 'Customers', 'View')) return;
      navigate('/customers');
      return;
    }
    if (tab === 'quotations') {
      if (!hasPermission(user, 'Quotations', 'View')) return;
      navigate('/quotations');
      return;
    }
    if (tab === 'purchase-orders') {
      if (!hasPermission(user, 'Purchase Orders', 'View')) return;
      navigate('/purchase-orders');
      return;
    }
    if (tab === 'finance') {
      if (String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN' && String(user?.role || '').toUpperCase() !== 'ADMIN' && !hasPermission(user, 'Finance', 'View')) return;
      navigate(routeState.financeSubView && routeState.financeSubView !== 'overview' ? `/finance/${routeState.financeSubView}` : '/finance');
      return;
    }
    if (tab === 'enquiries') {
      if (!hasPermission(user, 'Enquiries', 'View')) return;
      navigate('/enquiries');
      return;
    }
  };

  return (
    <CrmLayout
      user={user}
      onLogout={onLogout}
      activeTab={activeTab}
      setActiveTab={setSafeActiveTab}
      ordersSubView={ordersSubView}
      activeDocId={activeDocId}
      docType={docType}
      dcSubView={dcSubView}
      onNavigateDcSubView={(sub) => navigate(sub === 'overview' ? '/delivery-challans' : `/delivery-challans/${sub}`)}
      poSubView={poSubView}
      activePoId={activePoId}
      onNavigatePoSubView={(sub) => navigate(sub === 'overview' ? '/purchase-orders' : `/purchase-orders/${sub}`)}
      stockBranch={stockBranch}
      setStockBranch={handleSetStockBranch}
      stockProductCreate={stockProductCreate}
      setStockProductCreate={handleSetStockProductCreate}
      stockProductPriceHistory={stockProductPriceHistory}
      activeProductId={activeProductId}
      stockProductInfo={stockProductInfo}
      financeSubView={financeSubView}
      onNavigateToCreate={primaryEnquiryAction}
      primaryActionLabel={primaryEnquiryActionLabel}
      onNavigateToSettings={openSettings}
    >
      <CrmErrorBoundary resetKey={`${activeTab}-${poSubView || ''}-${enquirySubView || ''}-${ordersSubView || ''}-${quotationSubView || ''}-${dcSubView || ''}`}>
        {content}
      </CrmErrorBoundary>
    </CrmLayout>
  );
}

