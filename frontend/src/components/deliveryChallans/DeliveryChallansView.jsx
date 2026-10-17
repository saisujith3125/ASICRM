import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import DcOverview from './DcOverview';
import NewDcPage from './NewDcPage';
import DcHistoryPage from './DcHistoryPage';
import DcDispatchPage from './DcDispatchPage';
import DcReceivePage from './DcReceivePage';
import ReturnDcPage from './ReturnDcPage';
import NewReturnDcPage from './NewReturnDcPage';
import DcDocumentModal from './DcDocumentModal';
import './dcStyles.css';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function DeliveryChallansView({ user, dcSubView = 'overview', activeDcId = null, onNavigateCustomer }) {
  const [challans, setChallans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewDocData, setViewDocData] = useState(null);

  // Natural ascending sequence sorter (1 above 2: DC-000001, DC-000002...)
  const sortChallansAscending = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, []);

  // Fetch Delivery Challans
  const fetchChallans = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/api/orders/delivery-challans'), {
        headers: authHeaders(user)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChallans(sortChallansAscending(Array.isArray(data.data) ? data.data : []));
      } else {
        console.warn('Failed to fetch delivery challans:', data.message);
      }
    } catch (err) {
      console.error('Error fetching delivery challans:', err);
    }
  }, [user, sortChallansAscending]);

  // Fetch Orders (for linked orders)
  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/api/orders'), {
        headers: authHeaders(user)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrders(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  }, [user]);

  // Fetch Stocks (for available products and godown stocks)
  const fetchStocks = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/api/stocks'), {
        headers: authHeaders(user)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const productList = Array.isArray(data.data)
          ? data.data
          : (data.data?.products || []);
        setStocks(productList);
      }
    } catch (err) {
      console.error('Error fetching stocks:', err);
    }
  }, [user]);

  // Initial data load
  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([fetchChallans(), fetchOrders(), fetchStocks()]);
      } catch (err) {
        if (active) setError('Failed to load Delivery Challans data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAll();
    return () => { active = false; };
  }, [fetchChallans, fetchOrders, fetchStocks]);

  // Handle activeDcId from route (e.g. /delivery-challans/:id)
  useEffect(() => {
    if (!activeDcId) {
      return;
    }
    const found = challans.find(
      (c) => String(c.challanId).toLowerCase() === String(activeDcId).toLowerCase() ||
             String(c._id).toLowerCase() === String(activeDcId).toLowerCase()
    );
    if (found) {
      setViewDocData(found);
    } else if (!loading) {
      // Fetch specific DC if not yet in array
      (async () => {
        try {
          const res = await apiFetch(apiUrl(`/api/orders/delivery-challans/${encodeURIComponent(activeDcId)}`), {
            headers: authHeaders(user)
          });
          const data = await res.json();
          if (res.ok && data.success && data.data) {
            setViewDocData(data.data);
          }
        } catch (e) {
          console.warn('Could not fetch active DC:', e);
        }
      })();
    }
  }, [activeDcId, challans, loading, user]);

  const handleOpenDoc = (dc) => {
    setViewDocData(dc);
  };

  const handleCloseDoc = () => {
    setViewDocData(null);
    if (activeDcId) {
      navigate('/delivery-challans/history');
    }
  };

  const handleNavigateSubView = (sub) => {
    if (sub === 'overview') {
      navigate('/delivery-challans');
    } else {
      navigate(`/delivery-challans/${sub}`);
    }
  };

  if (loading && challans.length === 0) {
    return (
      <div className="dc-page-container" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="crm-loading-spinner" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#0f172a', fontWeight: 600 }}>Loading Delivery Challans...</h3>
        <p style={{ color: '#64748b' }}>Please wait while consignment records and stocks are synchronized.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dc-page-container" style={{ padding: '40px' }}>
        <div className="crm-banner-error">
          <p>{error}</p>
          <button type="button" className="crm-btn-secondary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-challans-module-wrapper">
      {/* Subview Content Rendering */}
      {dcSubView === 'new' ? (
        <NewDcPage
          user={user}
          orders={orders}
          stocks={stocks}
          onCancel={() => navigate('/delivery-challans')}
          onSuccess={(createdDC) => {
            if (createdDC) {
              setChallans((prev) => {
                const exists = prev.some((c) => c.challanId === createdDC.challanId || c._id === createdDC._id);
                if (exists) return prev;
                return sortChallansAscending([...prev, createdDC]);
              });
            }
            fetchChallans();
            fetchStocks();
            navigate('/delivery-challans/dispatch');
          }}
          onOpenDoc={handleOpenDoc}
        />
      ) : dcSubView === 'history' ? (
        <DcHistoryPage
          challans={challans}
          orders={orders}
          user={user}
          onOpenDoc={handleOpenDoc}
          onRefresh={fetchChallans}
        />
      ) : dcSubView === 'dispatch' ? (
        <DcDispatchPage
          challans={challans}
          user={user}
          onRefresh={fetchChallans}
          onOpenDoc={handleOpenDoc}
        />
      ) : dcSubView === 'receive' ? (
        <DcReceivePage
          challans={challans}
          user={user}
          onRefresh={fetchChallans}
          onOpenDoc={handleOpenDoc}
        />
      ) : dcSubView === 'return' ? (
        <ReturnDcPage
          challans={challans}
          user={user}
          onRefresh={() => {
            fetchChallans();
            fetchStocks();
          }}
          onOpenDoc={handleOpenDoc}
        />
      ) : dcSubView === 'return-new' ? (
        <NewReturnDcPage
          challans={challans}
          user={user}
          initialDcId={activeDcId}
          onRefresh={() => {
            fetchChallans();
            fetchStocks();
          }}
          onOpenDoc={handleOpenDoc}
        />
      ) : (
        <DcOverview
          challans={challans}
          onNavigateSubView={handleNavigateSubView}
          onOpenDoc={handleOpenDoc}
        />
      )}

      {/* Document View / Print Modal */}
      {viewDocData && (
        <DcDocumentModal
          challan={viewDocData}
          onClose={handleCloseDoc}
        />
      )}
    </div>
  );
}
