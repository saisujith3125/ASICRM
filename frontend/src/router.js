// Lightweight client-side router with HTML5 History API integration.
// Supports direct URL entry, browser refresh, back/forward navigation,
// and clean standard paths for ASICRM.

export function parseRoute(pathname = (typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/')) {
  // Normalize pathname: strip query params and hash if present, remove trailing slash, ensure leading slash
  let queryString = '';
  if (pathname && pathname.includes('?')) {
    queryString = pathname.split('?')[1] || '';
  } else if (typeof window !== 'undefined' && window.location.search) {
    queryString = window.location.search.replace(/^\?/, '');
  }
  let targetGrnId = null;
  let targetMovementId = null;
  let targetEnquiryId = null;
  let targetSettingsSection = null;
  if (queryString) {
    try {
      const sp = new URLSearchParams(queryString);
      targetGrnId = sp.get('grn') || null;
      targetMovementId = sp.get('movement') || sp.get('movementId') || null;
      targetEnquiryId = sp.get('enquiryId') || sp.get('enquiry') || null;
      targetSettingsSection = sp.get('section') || null;
    } catch {}
  }

  const cleanPath = (pathname || '/').split(/[?#]/)[0];
  const path = (cleanPath.replace(/\/+$/, '') || '/').toLowerCase();
  const parts = path.split('/').filter(Boolean);

  // Root / -> default home behavior (enquiries list)
  if (parts.length === 0) {
    return {
      path: '/',
      activeTab: 'enquiries',
      enquirySubView: 'list',
      activeEnquiryId: null,
      activeCustomerId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  const [section, sub, action] = parts;

  // 1. STOCKS ROUTES
  // /stocks
  // /stocks/categories
  // /stocks/subcategories
  // /stocks/brands
  // /stocks/products
  // /stocks/products/new
  if (section === 'stocks') {
    if (sub === 'categories') {
      return {
        path: '/stocks/categories',
        activeTab: 'stocks',
        stockBranch: 'categories',
        stockProductCreate: false,
        stockProductInfo: null,
        activeCustomerId: null,
        activeEnquiryId: null
      };
    }
    if (sub === 'subcategories') {
      return {
        path: '/stocks/subcategories',
        activeTab: 'stocks',
        stockBranch: 'subcategories',
        stockProductCreate: false,
        stockProductInfo: null,
        activeCustomerId: null,
        activeEnquiryId: null
      };
    }
    if (sub === 'brands') {
      return {
        path: '/stocks/brands',
        activeTab: 'stocks',
        stockBranch: 'brands',
        stockProductCreate: false,
        stockProductInfo: null,
        activeCustomerId: null,
        activeEnquiryId: null
      };
    }
    if (sub === 'movements' || sub === 'movement') {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const qpProdId = sp ? (sp.get('productId') || sp.get('product') || sp.get('prodId')) : null;
      return {
        path: qpProdId ? `/stocks/movements?productId=${encodeURIComponent(qpProdId)}` : '/stocks/movements',
        activeTab: 'stocks',
        stockBranch: 'movements',
        stockProductCreate: false,
        stockProductPriceHistory: false,
        stockProductMovements: Boolean(qpProdId),
        activeProductId: qpProdId || null,
        stockProductInfo: null,
        activeCustomerId: null,
        activeEnquiryId: null
      };
    }
    if (sub === 'price-history' || sub === 'pricehistory') {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const qpProdId = sp ? (sp.get('productId') || sp.get('product') || sp.get('prodId')) : null;
      return {
        path: qpProdId ? `/stocks/price-history?productId=${encodeURIComponent(qpProdId)}` : '/stocks/price-history',
        activeTab: 'stocks',
        stockBranch: 'price-history',
        stockProductCreate: false,
        stockProductPriceHistory: true,
        stockProductMovements: false,
        activeProductId: qpProdId || null,
        stockProductInfo: null,
        activeCustomerId: null,
        activeEnquiryId: null
      };
    }
    if (sub === 'products') {
      const rawParts = cleanPath.split('/').filter(Boolean);
      const rawAction = rawParts[2];
      const rawSubAction = rawParts[3];

      if (action === 'new') {
        return {
          path: '/stocks/products/new',
          activeTab: 'stocks',
          stockBranch: 'products',
          stockProductCreate: true,
          stockProductPriceHistory: false,
          activeProductId: null,
          stockProductInfo: null,
          activeCustomerId: null,
          activeEnquiryId: null
        };
      }

      if (rawAction && rawAction !== 'new') {
        const prodId = decodeURIComponent(rawAction);
        if (rawSubAction && (rawSubAction.toLowerCase() === 'price-history' || rawSubAction.toLowerCase() === 'pricehistory')) {
          return {
            path: `/stocks/products/${prodId}/price-history`,
            activeTab: 'stocks',
            stockBranch: 'products',
            stockProductCreate: false,
            stockProductEdit: false,
            stockProductPriceHistory: true,
            stockProductMovements: false,
            activeProductId: prodId,
            stockProductInfo: null,
            activeCustomerId: null,
            activeEnquiryId: null
          };
        }
        if (rawSubAction && (rawSubAction.toLowerCase() === 'movements' || rawSubAction.toLowerCase() === 'movement' || rawSubAction.toLowerCase() === 'stock-movement' || rawSubAction.toLowerCase() === 'stock-movements')) {
          return {
            path: `/stocks/products/${prodId}/movements`,
            activeTab: 'stocks',
            stockBranch: 'movements',
            stockProductCreate: false,
            stockProductEdit: false,
            stockProductPriceHistory: false,
            stockProductMovements: true,
            activeProductId: prodId,
            stockProductInfo: null,
            activeCustomerId: null,
            activeEnquiryId: null
          };
        }
        if (rawSubAction && rawSubAction.toLowerCase() === 'edit') {
          return {
            path: `/stocks/products/${prodId}/edit`,
            activeTab: 'stocks',
            stockBranch: 'products',
            stockProductCreate: false,
            stockProductEdit: true,
            stockProductPriceHistory: false,
            stockProductMovements: false,
            activeProductId: prodId,
            stockProductInfo: null,
            activeCustomerId: null,
            activeEnquiryId: null
          };
        }
        return {
          path: `/stocks/products/${prodId}`,
          activeTab: 'stocks',
          stockBranch: 'products',
          stockProductCreate: false,
          stockProductEdit: false,
          stockProductPriceHistory: false,
          activeProductId: prodId,
          targetMovementId,
          stockProductInfo: null,
          activeCustomerId: null,
          activeEnquiryId: null
        };
      }

      return {
        path: '/stocks/products',
        activeTab: 'stocks',
        stockBranch: 'products',
        stockProductCreate: false,
        stockProductPriceHistory: false,
        activeProductId: null,
        stockProductInfo: null,
        activeCustomerId: null,
        activeEnquiryId: null
      };
    }
    // Default /stocks -> Stocks Overview
    return {
      path: '/stocks',
      activeTab: 'stocks',
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null,
      activeCustomerId: null,
      activeEnquiryId: null
    };
  }

  // 2. CUSTOMER ROUTES
  // /customers
  // /customers/:id
  if (section === 'customers') {
    if (sub) {
      // Decode original casing from raw pathname
      const rawSub = pathname.split('/')[2] || sub;
      const customerId = decodeURIComponent(rawSub);
      return {
        path: `/customers/${customerId}`,
        activeTab: 'customers',
        activeCustomerId: customerId,
        enquirySubView: 'list',
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/customers',
      activeTab: 'customers',
      activeCustomerId: null,
      enquirySubView: 'list',
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 2.5. SUPPLIER ROUTES
  // /suppliers
  // /suppliers/:id
  if (section === 'suppliers' || section === 'supplier') {
    if (sub) {
      const rawSub = pathname.split('/')[2] || sub;
      const supplierId = decodeURIComponent(rawSub);
      return {
        path: `/purchase-orders/suppliers/${supplierId}`,
        activeTab: 'purchase-orders',
        poSubView: 'supplier-detail',
        activeSupplierId: supplierId,
        activePoId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/purchase-orders/suppliers',
      activeTab: 'purchase-orders',
      poSubView: 'suppliers',
      activeSupplierId: null,
      activePoId: null,
      activeCustomerId: null,
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 3. QUOTATIONS ROUTES
  // /quotations
  // /quotations/new
  // /quotations/:id
  if (section === 'quotations') {
    if (sub === 'new' || sub === 'create') {
      return {
        path: targetEnquiryId ? `/quotations/new?enquiryId=${encodeURIComponent(targetEnquiryId)}` : '/quotations/new',
        activeTab: 'quotations',
        quotationSubView: 'new',
        activeQuotationId: null,
        activeEnquiryId: targetEnquiryId || null,
        enquirySubView: targetEnquiryId ? 'quotation' : 'list',
        activeCustomerId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub) {
      const rawSub = pathname.split('/')[2] || sub;
      const quotationId = decodeURIComponent(rawSub);
      return {
        path: `/quotations/${quotationId}`,
        activeTab: 'quotations',
        quotationSubView: 'details',
        activeQuotationId: quotationId,
        activeEnquiryId: null,
        enquirySubView: 'quotation',
        activeCustomerId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/quotations',
      activeTab: 'quotations',
      quotationSubView: 'list',
      activeQuotationId: null,
      activeEnquiryId: null,
      enquirySubView: 'list',
      activeCustomerId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 3.5. PURCHASE ORDERS ROUTES
  // /purchase-orders
  // /purchase-orders/new
  // /purchase-orders/history
  // /purchase-orders/receive
  // /purchase-orders/:id
  // /purchase-orders/:id/receive
  if (section === 'purchase-orders' || section === 'purchaseorders') {
    if (sub === 'new' || sub === 'create') {
      return {
        path: '/purchase-orders/new',
        activeTab: 'purchase-orders',
        poSubView: 'new',
        activePoId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'sent' || sub === 'sent-items' || sub === 'sent-orders') {
      return {
        path: '/purchase-orders/sent',
        activeTab: 'purchase-orders',
        poSubView: 'sent',
        activePoId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'suppliers' || sub === 'supplier') {
      const rawSupId = pathname.split('/')[3] || action || '';
      const supplierId = rawSupId ? decodeURIComponent(String(rawSupId).split(/[?#]/)[0]) : null;
      if (supplierId) {
        return {
          path: `/purchase-orders/suppliers/${supplierId}`,
          activeTab: 'purchase-orders',
          poSubView: 'supplier-detail',
          activeSupplierId: supplierId,
          activePoId: null,
          activeCustomerId: null,
          activeEnquiryId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      return {
        path: '/purchase-orders/suppliers',
        activeTab: 'purchase-orders',
        poSubView: 'suppliers',
        activeSupplierId: null,
        activePoId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'history') {
      return {
        path: '/purchase-orders/history',
        activeTab: 'purchase-orders',
        poSubView: 'history',
        activePoId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'receive') {
      return {
        path: '/purchase-orders/receive',
        activeTab: 'purchase-orders',
        poSubView: 'receive',
        activePoId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'grn' || sub === 'receipts') {
      const rawGrn = pathname.split('/')[3] || action || '';
      const grnId = decodeURIComponent(String(rawGrn).split(/[?#]/)[0]);
      return {
        path: `/purchase-orders/grn/${grnId}`,
        activeTab: 'purchase-orders',
        poSubView: 'grn-details',
        activeGrnId: grnId,
        activePoId: null,
        targetGrnId: grnId || targetGrnId,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub && sub !== 'overview' && sub !== 'details') {
      const rawSub = pathname.split('/')[2] || sub;
      const poId = decodeURIComponent(String(rawSub).split(/[?#]/)[0]);
      if (action === 'receive') {
        return {
          path: `/purchase-orders/${poId}/receive`,
          activeTab: 'purchase-orders',
          poSubView: 'receive-po',
          activePoId: poId,
          targetGrnId: targetGrnId,
          activeCustomerId: null,
          activeEnquiryId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      if (action === 'edit') {
        return {
          path: `/purchase-orders/${poId}/edit`,
          activeTab: 'purchase-orders',
          poSubView: 'edit',
          activePoId: poId,
          targetGrnId: targetGrnId,
          activeCustomerId: null,
          activeEnquiryId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      return {
        path: `/purchase-orders/${poId}`,
        activeTab: 'purchase-orders',
        poSubView: 'details',
        activePoId: poId,
        targetGrnId: targetGrnId,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/purchase-orders',
      activeTab: 'purchase-orders',
      poSubView: 'overview',
      activePoId: null,
      activeCustomerId: null,
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 4. DELIVERY CHALLANS ROUTES
  // /delivery-challans
  // /delivery-challans/new
  // /delivery-challans/history
  // /delivery-challans/dispatch
  // /delivery-challans/receive
  // /delivery-challans/return
  // /delivery-challans/:id
  if (section === 'delivery-challans' || section === 'deliverychallans') {
    if (sub === 'new' || sub === 'create') {
      return {
        path: '/delivery-challans/new',
        activeTab: 'delivery-challans',
        dcSubView: 'new',
        activeDcId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'history') {
      return {
        path: '/delivery-challans/history',
        activeTab: 'delivery-challans',
        dcSubView: 'history',
        activeDcId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'dispatch') {
      return {
        path: '/delivery-challans/dispatch',
        activeTab: 'delivery-challans',
        dcSubView: 'dispatch',
        activeDcId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'receive') {
      return {
        path: '/delivery-challans/receive',
        activeTab: 'delivery-challans',
        dcSubView: 'receive',
        activeDcId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'return') {
      if (action === 'new' || action === 'initiate' || action === 'create') {
        return {
          path: '/delivery-challans/return/new',
          activeTab: 'delivery-challans',
          dcSubView: 'return-new',
          activeDcId: null,
          activeCustomerId: null,
          activeEnquiryId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      return {
        path: '/delivery-challans/return',
        activeTab: 'delivery-challans',
        dcSubView: 'return',
        activeDcId: null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub) {
      const rawSub = pathname.split('/')[2] || sub;
      const dcId = decodeURIComponent(rawSub);
      return {
        path: `/delivery-challans/${dcId}`,
        activeTab: 'delivery-challans',
        dcSubView: 'history',
        activeDcId: dcId,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/delivery-challans',
      activeTab: 'delivery-challans',
      dcSubView: 'overview',
      activeDcId: null,
      activeCustomerId: null,
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 5. ORDERS ROUTES
  // /orders
  // /orders/invoices
  if (section === 'orders') {
    if (sub === 'delivery-challans') {
      const docId = action ? decodeURIComponent(pathname.split('/')[3] || action) : null;
      return {
        path: docId ? `/delivery-challans/${docId}` : '/delivery-challans',
        activeTab: 'delivery-challans',
        dcSubView: docId ? 'history' : 'overview',
        activeDcId: docId,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'proformas' || sub === 'proforma') {
      const isNew = action === 'new' || action === 'create';
      const docId = (!isNew && action) ? decodeURIComponent(pathname.split('/')[3] || action) : null;
      return {
        path: isNew ? '/orders/proformas/new' : (docId ? `/orders/proformas/${docId}` : '/orders/proformas'),
        activeTab: 'orders',
        ordersSubView: 'proformas',
        proformaCreate: isNew,
        activeDocId: docId,
        docType: docId ? 'PI' : null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'invoices') {
      const docId = action ? decodeURIComponent(pathname.split('/')[3] || action) : null;
      return {
        path: docId ? `/orders/invoices/${docId}` : '/orders/invoices',
        activeTab: 'orders',
        ordersSubView: 'invoices',
        activeDocId: docId,
        docType: docId ? 'INV' : null,
        activeCustomerId: null,
        activeEnquiryId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/orders',
      activeTab: 'orders',
      ordersSubView: 'orders',
      activeCustomerId: null,
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // Direct alias: /proformas, /proformas/new, /proformas/:id
  if (section === 'proformas' || section === 'proforma') {
    const isNew = sub === 'new' || sub === 'create';
    const docId = (!isNew && sub) ? decodeURIComponent(pathname.split('/')[2] || sub) : null;
    return {
      path: isNew ? '/orders/proformas/new' : (docId ? `/orders/proformas/${docId}` : '/orders/proformas'),
      activeTab: 'orders',
      ordersSubView: 'proformas',
      proformaCreate: isNew,
      activeDocId: docId,
      docType: docId ? 'PI' : null,
      activeCustomerId: null,
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 6. SETTINGS ROUTE
  // /settings
  // /settings/:section
  if (section === 'settings') {
    const sec = sub || targetSettingsSection || null;
    return {
      path: sec ? `/settings/${sec}` : '/settings',
      activeTab: 'settings',
      settingsSection: sec,
      activeCustomerId: null,
      activeEnquiryId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // 6. ENQUIRIES ROUTES
  // /enquiries
  // /enquiries/create or /enquiries/new
  // /enquiries/queue
  // /enquiries/:id
  // /enquiries/:id/followup
  // /enquiries/:id/quotation
  // /enquiries/:id/solved
  if (section === 'enquiries') {
    if (sub === 'create' || sub === 'new') {
      return {
        path: '/enquiries/create',
        activeTab: 'enquiries',
        enquirySubView: 'create',
        activeEnquiryId: null,
        activeCustomerId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub === 'queue') {
      return {
        path: '/enquiries/queue',
        activeTab: 'enquiries',
        enquirySubView: 'queue',
        activeEnquiryId: null,
        activeCustomerId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    if (sub) {
      const rawSub = pathname.split('/')[2] || sub;
      const enquiryId = decodeURIComponent(rawSub);
      if (action === 'followup' || action === 'follow-up') {
        return {
          path: `/enquiries/${enquiryId}/followup`,
          activeTab: 'enquiries',
          enquirySubView: 'followup',
          activeEnquiryId: enquiryId,
          activeCustomerId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      if (action === 'quotation') {
        return {
          path: `/enquiries/${enquiryId}/quotation`,
          activeTab: 'quotations',
          quotationSubView: 'new',
          enquirySubView: 'quotation',
          activeQuotationId: null,
          activeEnquiryId: enquiryId,
          activeCustomerId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      if (action === 'solved') {
        return {
          path: `/enquiries/${enquiryId}/solved`,
          activeTab: 'enquiries',
          enquirySubView: 'solved',
          activeEnquiryId: enquiryId,
          activeCustomerId: null,
          stockBranch: 'overview',
          stockProductCreate: false,
          stockProductInfo: null
        };
      }
      return {
        path: `/enquiries/${enquiryId}`,
        activeTab: 'enquiries',
        enquirySubView: 'details',
        activeEnquiryId: enquiryId,
        activeCustomerId: null,
        stockBranch: 'overview',
        stockProductCreate: false,
        stockProductInfo: null
      };
    }
    return {
      path: '/enquiries',
      activeTab: 'enquiries',
      enquirySubView: 'list',
      activeEnquiryId: null,
      activeCustomerId: null,
      stockBranch: 'overview',
      stockProductCreate: false,
      stockProductInfo: null
    };
  }

  // Fallback to enquiries
  return {
    path: '/enquiries',
    activeTab: 'enquiries',
    enquirySubView: 'list',
    activeEnquiryId: null,
    activeCustomerId: null,
    stockBranch: 'overview',
    stockProductCreate: false,
    stockProductInfo: null
  };
}

// Programmatic navigation helper
export function navigate(to, options = {}) {
  if (typeof window === 'undefined') return;

  const currentPath = window.location.pathname + window.location.search;
  if (currentPath === to && !options.force) return;

  if (options.replace) {
    window.history.replaceState(options.state || null, '', to);
  } else {
    window.history.pushState(options.state || null, '', to);
  }

  window.dispatchEvent(new CustomEvent('app-route-change', { detail: { path: to } }));
}
