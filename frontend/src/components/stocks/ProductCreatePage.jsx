import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { useCompanyConfig } from '../documents/companyConfig';

const EMPTY_FORM = {
  code: '', name: '', hsnSac: '', description: '', categoryId: '', subcategoryId: '', brandId: '', unit: 'Nos', size: '',
  cost: '', dealerPercentage: '', dealerPrice: '', mrpPercentage: '', mrp: '', gst: '', stock: '', alertQuantity: '',
  productDetails: '', productLink: '', serialized: true, isIGSTApplicable: false
};

const DEFAULT_FALLBACK_UNITS = ['Nos', 'Box', 'Set', 'Meter', 'Roll'];
const DEFAULT_UNITS = DEFAULT_FALLBACK_UNITS.map((id) => ({ id, name: id }));

const isTestRecord = (record) => {
  const name = String(record?.name || '').trim();
  const description = String(record?.description || '').trim();
  const code = String(record?.code || record?.id || '').trim();
  return (
    /^test\b/i.test(name) ||
    /^test\b/i.test(description) ||
    /^(cat|cat2|subcat|brand)\s+\d{8,}$/i.test(name) ||
    /^brand\s+\d{8,}$/i.test(code)
  );
};

function headers(user) {
  return { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' };
}

export default function ProductCreatePage({ user, onCancel, onSuccess, initialValues = null, mode = 'create', productId = null }) {
  const isEditMode = mode === 'edit';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const fromParam = searchParams ? searchParams.get('from') : null;
  const returnToParam = searchParams ? searchParams.get('returnTo') : null;
  const sessionFrom = typeof window !== 'undefined' ? sessionStorage.getItem('asicrm_product_from') : null;
  const sessionReturn = typeof window !== 'undefined' ? sessionStorage.getItem('asicrm_product_return') : null;

  const isFromDC = fromParam === 'dc' ||
    sessionFrom === 'dc' ||
    Boolean(returnToParam && returnToParam.includes('delivery-challan')) ||
    Boolean(sessionReturn && sessionReturn.includes('delivery-challan'));

  const dcReturnUrl = returnToParam || sessionReturn || '/delivery-challans/new';

  const isFromQuotation = !isFromDC && (
    fromParam === 'quotation' ||
    sessionFrom === 'quotation' ||
    Boolean(returnToParam && (returnToParam.includes('quotation') || returnToParam.includes('enquir'))) ||
    Boolean(sessionReturn && (sessionReturn.includes('quotation') || sessionReturn.includes('enquir')))
  );

  const quotationReturnUrl = returnToParam || sessionReturn || '/quotations/new';

  const handleBackNavigation = () => {
    if (isFromDC) {
      try {
        sessionStorage.removeItem('asicrm_product_from');
      } catch {}
      if (onCancel) {
        onCancel();
      } else {
        navigate(dcReturnUrl);
      }
    } else if (isFromQuotation) {
      try {
        sessionStorage.removeItem('asicrm_product_from');
      } catch {}
      if (onCancel) {
        onCancel();
      } else {
        navigate(quotationReturnUrl);
      }
    } else {
      if (onCancel) {
        onCancel();
      } else {
        navigate('/stocks/products');
      }
    }
  };

  const [data, setData] = useState({ categories: [], subcategories: [], brands: [] });
  const [form, setForm] = useState(() => {
    let preloaded = {};
    if (isEditMode) {
      try {
        const sessionPreload = sessionStorage.getItem('asicrm_product_preload');
        if (sessionPreload) {
          preloaded = JSON.parse(sessionPreload) || {};
          sessionStorage.removeItem('asicrm_product_preload');
        }
      } catch {}
    } else {
      // In create mode, purge any leftover preload so previous products never contaminate new product creation
      try {
        sessionStorage.removeItem('asicrm_product_preload');
      } catch {}
    }
    return {
      ...EMPTY_FORM,
      ...(isEditMode ? preloaded : {}),
      ...(isEditMode ? (initialValues || {}) : {})
    };
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [saved, setSaved] = useState(false);
  const [quickModal, setQuickModal] = useState(null);
  const [serialNumbersText, setSerialNumbersText] = useState('');

  const companyConfig = useCompanyConfig(user);

  const defaultUnitName = useMemo(() => {
    const raw = companyConfig?.defaultProductUnit;
    if (!raw || raw === 'Piece') return 'Nos';
    return raw;
  }, [companyConfig?.defaultProductUnit]);

  const unitsList = useMemo(() => {
    if (Array.isArray(companyConfig?.productUnits) && companyConfig.productUnits.length > 0) {
      const filtered = companyConfig.productUnits
        .filter((u) => u.status !== 'Inactive')
        .map((u) => {
          const name = (u.name === 'Piece' || u.id === 'Piece') ? 'Nos' : (u.name || u.id);
          return { id: name, name };
        });
      if (filtered.length > 0) return filtered;
    }
    return DEFAULT_UNITS;
  }, [companyConfig?.productUnits]);

  const normalizeUnitValue = (u) => {
    if (!u || u === 'Piece' || u === 'piece') return defaultUnitName;
    const found = unitsList.find((item) => item.id.toLowerCase() === String(u).toLowerCase());
    return found ? found.id : u;
  };

  useEffect(() => {
    if (!isEditMode && defaultUnitName) {
      setForm((current) => {
        if (!current.unit || current.unit === 'Nos' || current.unit === 'Piece') {
          return { ...current, unit: defaultUnitName };
        }
        return current;
      });
    }
  }, [defaultUnitName, isEditMode]);
  const codeInputRef = React.useRef(null);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleCodeChange = (val) => {
    const clean = String(val || '').toUpperCase().trimStart();
    update('code', clean);
    if (!clean.trim()) {
      setCodeError('');
      return;
    }
    const cleanTrimmed = clean.trim();
    const cleanCompact = cleanTrimmed.replace(/[^A-Z0-9]/g, '');
    const isDup = (data.products || []).some((p) => {
      if ((isEditMode || form.id) && (String(p.id) === String(productId || form.id) || String(p.code).trim().toUpperCase() === cleanTrimmed)) return false;
      const pNorm = String(p.code || '').trim().toUpperCase();
      const pCompact = pNorm.replace(/[^A-Z0-9]/g, '');
      return pNorm === cleanTrimmed || (cleanCompact && pCompact === cleanCompact);
    });
    if (isDup) {
      setCodeError(`Product code ${cleanTrimmed} is already in use.`);
    } else {
      setCodeError('');
    }
  };

  const handleQuickSave = async () => {
    if (!quickModal) return;
    const { type, categoryId, name, description } = quickModal;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setQuickModal((prev) => ({ ...prev, error: 'Name is required.' }));
      return;
    }
    if (type === 'subcategory' && !categoryId) {
      setQuickModal((prev) => ({ ...prev, error: 'Parent category is required.' }));
      return;
    }

    setQuickModal((prev) => ({ ...prev, saving: true, error: '' }));

    let url = '';
    let payload = {};
    if (type === 'category') {
      url = '/api/stocks/categories';
      payload = { name: trimmedName, description: (description || '').trim() };
    } else if (type === 'subcategory') {
      url = '/api/stocks/subcategories';
      payload = { name: trimmedName, categoryId, description: (description || '').trim() };
    } else if (type === 'brand') {
      url = '/api/stocks/brands';
      payload = { name: trimmedName, description: (description || '').trim() };
    }

    try {
      const response = await apiFetch(apiUrl(url), {
        method: 'POST',
        headers: headers(user),
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || `Unable to create ${type}.`);
      }

      if (json.data) {
        setData(json.data);
      }

      if (type === 'category') {
        const created = (json.data?.categories || []).find(
          (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (created) {
          setForm((prev) => ({ ...prev, categoryId: created.id, subcategoryId: '' }));
        }
      } else if (type === 'subcategory') {
        const created = (json.data?.subcategories || []).find(
          (s) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.categoryId === categoryId
        );
        if (created) {
          setForm((prev) => ({ ...prev, subcategoryId: created.id }));
        }
      } else if (type === 'brand') {
        const created = (json.data?.brands || []).find(
          (b) => b.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (created) {
          setForm((prev) => ({ ...prev, brandId: created.id }));
        }
      }

      setQuickModal(null);
    } catch (err) {
      setQuickModal((prev) => ({
        ...prev,
        saving: false,
        error: err.message || `Unable to create ${type}.`
      }));
    }
  };


  useEffect(() => {
    if (!loading) {
      codeInputRef.current?.focus();
      const timer = setTimeout(() => {
        codeInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await apiFetch(apiUrl('/api/stocks'), { headers: headers(user) });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.message || 'Unable to load stock master.');
        if (active) {
          setData(json.data || { categories: [], subcategories: [], brands: [] });
          if (isEditMode && productId) {
            const found = (json.data?.products || []).find((p) => String(p.id) === String(productId) || String(p.code) === String(productId));
            if (found) {
              const cost = Number(found.cost || 0);
              const dealer = Number(found.dealerPrice || 0);
              const mrp = Number(found.mrp || 0);
              const derivedDealerPct = cost > 0 ? (((dealer - cost) / cost) * 100).toFixed(2) : '';
              const derivedMrpPct = cost > 0 ? (((mrp - cost) / cost) * 100).toFixed(2) : '';
              setForm({
                ...EMPTY_FORM,
                ...found,
                unit: normalizeUnitValue(found.unit),
                size: found.size != null ? String(found.size) : '',
                cost: found.cost != null ? String(found.cost) : '',
                dealerPercentage: found.dealerPercentage != null ? String(found.dealerPercentage) : derivedDealerPct,
                dealerPrice: found.dealerPrice != null ? String(found.dealerPrice) : '',
                mrpPercentage: found.mrpPercentage != null ? String(found.mrpPercentage) : derivedMrpPct,
                mrp: found.mrp != null ? String(found.mrp) : '',
                gst: found.gst != null ? String(found.gst) : '',
                stock: found.stock != null ? String(found.stock) : '',
                alertQuantity: found.alertQuantity != null ? String(found.alertQuantity) : '',
                serialized: found.serialized !== undefined ? Boolean(found.serialized) : true,
                isIGSTApplicable: Boolean(found.isIGSTApplicable)
              });
            } else {
              setError(`Product "${productId}" not found.`);
            }
          } else {
            setForm((current) => {
              if (!isEditMode) {
                // In create mode: strictly treat as fresh new product
                if (!current.code) {
                  apiFetch(apiUrl('/api/stocks/products/next-code'), { headers: headers(user) })
                    .then((codeRes) => codeRes.json())
                    .then((codeJson) => {
                      if (codeJson.success && codeJson.nextCode && active) {
                        setForm((prev) => (prev.code ? prev : { ...prev, code: codeJson.nextCode }));
                      }
                    })
                    .catch(() => {});
                }
                return current;
              }

              const matched = (current.id ? (json.data?.products || []).find((p) => String(p.id) === String(current.id)) : null) ||
                (current.code ? (json.data?.products || []).find((p) => String(p.code).trim().toUpperCase() === String(current.code).trim().toUpperCase()) : null);
              if (matched) {
                const cost = Number(matched.cost || 0);
                const dealer = Number(matched.dealerPrice || 0);
                const mrp = Number(matched.mrp || 0);
                const derivedDealerPct = cost > 0 ? (((dealer - cost) / cost) * 100).toFixed(2) : '';
                const derivedMrpPct = cost > 0 ? (((mrp - cost) / cost) * 100).toFixed(2) : '';
                return {
                  ...current,
                  ...matched,
                  name: current.name || matched.name || '',
                  hsnSac: current.hsnSac || matched.hsnSac || '',
                  description: current.description || matched.description || '',
                  categoryId: current.categoryId || matched.categoryId || '',
                  subcategoryId: current.subcategoryId || matched.subcategoryId || '',
                  brandId: current.brandId || matched.brandId || '',
                  unit: normalizeUnitValue(current.unit || matched.unit || 'Nos'),
                  cost: current.cost !== '' ? current.cost : (matched.cost != null ? String(matched.cost) : ''),
                  dealerPercentage: current.dealerPercentage !== '' ? current.dealerPercentage : (matched.dealerPercentage != null ? String(matched.dealerPercentage) : derivedDealerPct),
                  dealerPrice: current.dealerPrice !== '' ? current.dealerPrice : (matched.dealerPrice != null ? String(matched.dealerPrice) : ''),
                  mrpPercentage: current.mrpPercentage !== '' ? current.mrpPercentage : (matched.mrpPercentage != null ? String(matched.mrpPercentage) : derivedMrpPct),
                  mrp: current.mrp !== '' ? current.mrp : (matched.mrp != null ? String(matched.mrp) : ''),
                  gst: current.gst !== '' ? current.gst : (matched.gst != null ? String(matched.gst) : ''),
                  stock: current.stock !== '' ? current.stock : (matched.stock != null ? String(matched.stock) : '0'),
                  alertQuantity: current.alertQuantity !== '' ? current.alertQuantity : (matched.alertQuantity != null ? String(matched.alertQuantity) : '10'),
                  serialized: current.serialized !== undefined ? current.serialized : (matched.serialized !== undefined ? Boolean(matched.serialized) : true),
                  isIGSTApplicable: current.isIGSTApplicable !== undefined ? current.isIGSTApplicable : Boolean(matched.isIGSTApplicable)
                };
              }
              if (!current.code) {
                apiFetch(apiUrl('/api/stocks/products/next-code'), { headers: headers(user) })
                  .then((codeRes) => codeRes.json())
                  .then((codeJson) => {
                    if (codeJson.success && codeJson.nextCode && active) {
                      setForm((prev) => (prev.code ? prev : { ...prev, code: codeJson.nextCode }));
                    }
                  })
                  .catch(() => {});
              }
              return current;
            });
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Unable to load stock master.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user?.id, user?.role, isEditMode, productId]);

  const visibleCategories = useMemo(() => (data.categories || []).filter((item) => !isTestRecord(item)), [data.categories]);
  const subcategories = useMemo(
    () => (data.subcategories || []).filter(
      (item) => !isTestRecord(item) && (!form.categoryId || item.categoryId === form.categoryId) &&
        visibleCategories.some((category) => category.id === item.categoryId)
    ),
    [data.subcategories, form.categoryId, visibleCategories]
  );
  const visibleBrands = useMemo(() => (data.brands || []).filter((brand) => !isTestRecord(brand)), [data.brands]);

  const existingMatch = useMemo(() => {
    if (!isEditMode) return null;
    const list = data.products || [];
    if (productId) {
      const p = list.find((item) => String(item.id) === String(productId) || String(item.code) === String(productId));
      if (p) return p;
    }
    if (form.id) {
      const p = list.find((item) => String(item.id) === String(form.id));
      if (p) return p;
    }
    if (form.code && form.code.trim()) {
      const p = list.find((item) => String(item.code).trim().toUpperCase() === String(form.code).trim().toUpperCase());
      if (p) return p;
    }
    return null;
  }, [isEditMode, data.products, productId, form.id, form.code]);

  const isExistingProduct = Boolean(isEditMode && (productId || form.id || existingMatch));

  // Cable identification rule: cables NEVER have serial numbers
  const isCable = useMemo(() => {
    const cat = visibleCategories.find((c) => c.id === form.categoryId);
    const sub = subcategories.find((s) => s.id === form.subcategoryId);
    const catId = String(form.categoryId || '').toUpperCase();
    if (catId === 'CAT-000004' || /cable/i.test(cat?.name || '')) return true;
    if (/cable/i.test(sub?.name || '')) return true;
    const name = String(form.name || '').trim();
    if (/\bcables?\b/i.test(name) || /cat\s*6\s*cable/i.test(name) || /utp\s*cable/i.test(name) || /patch\s*cord/i.test(name) || /fiber\s*cable/i.test(name)) {
      return true;
    }
    const unit = String(form.unit || '').trim();
    if ((unit === 'Meter' || unit === 'Roll') && /cable|wire/i.test(name)) return true;
    return false;
  }, [form.categoryId, form.subcategoryId, form.name, form.unit, visibleCategories, subcategories]);

  // When cable product is detected, force serialized = false; when non-cable, restore serialized = true
  useEffect(() => {
    if (isCable) {
      if (form.serialized) {
        setForm((prev) => ({ ...prev, serialized: false }));
        setSerialNumbersText('');
      }
    } else {
      if (form.serialized === false && !isExistingProduct) {
        setForm((prev) => ({ ...prev, serialized: true }));
      }
    }
  }, [isCable, isExistingProduct]);

  const parsedSerials = useMemo(() => {
    if (!serialNumbersText) return [];
    return serialNumbersText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [serialNumbersText]);

  const handleAutoGenerateSerials = () => {
    const qty = parseInt(form.stock, 10) || 0;
    if (qty <= 0) return;
    const code = String(form.code || 'ASI-01').trim().toUpperCase();
    const generated = Array.from({ length: qty }, (_, i) => `${code}-SN-${1001 + i}`);
    setSerialNumbersText(generated.join('\n'));
  };

  const costNum = Number(form.cost || 0);
  const dealerPriceNum = Number(form.dealerPrice || 0);
  const mrpNum = Number(form.mrp || 0);
  const dealerPercentageNum = Number(form.dealerPercentage || 0);
  const mrpPercentageNum = Number(form.mrpPercentage || 0);

  const gst = Number(form.gst || 0);
  const cgst = form.isIGSTApplicable ? '0.00' : (gst > 0 ? (gst / 2).toFixed(2) : '0.00');
  const sgst = form.isIGSTApplicable ? '0.00' : (gst > 0 ? (gst / 2).toFixed(2) : '0.00');
  const igst = form.isIGSTApplicable ? (gst > 0 ? Number(gst).toFixed(2) : '0.00') : '0.00';

  let costError = '';
  if (form.cost !== '' && costNum <= 0) {
    costError = 'Purchase Cost must be greater than 0.';
  }

  const formattedCost = costNum % 1 === 0 ? costNum : costNum.toFixed(2);
  const formattedDealer = dealerPriceNum % 1 === 0 ? dealerPriceNum : dealerPriceNum.toFixed(2);

  let dealerPriceError = '';
  if (costNum > 0) {
    if (form.dealerPrice !== '' && dealerPriceNum < costNum) {
      dealerPriceError = `The value should be equal or more than ${formattedCost}`;
    } else if (form.dealerPercentage !== '' && dealerPercentageNum < 0) {
      dealerPriceError = `The value should be equal or more than ${formattedCost}`;
    }
  }

  const isDealerPriceValid = costNum > 0 && form.dealerPrice !== '' && !dealerPriceError && dealerPriceNum >= costNum;

  let mrpError = '';
  if (isDealerPriceValid) {
    if (form.mrp !== '' && mrpNum < dealerPriceNum) {
      mrpError = `The value should be equal or more than ${formattedDealer}`;
    } else if (form.mrpPercentage !== '' && mrpPercentageNum < dealerPercentageNum) {
      mrpError = `The value should be equal or more than ${formattedDealer}`;
    }
  }

  const handleCostChange = (val) => {
    const raw = String(val ?? '');
    setForm((current) => {
      const next = { ...current, cost: raw };
      const numCost = Number(raw);
      if (!isNaN(numCost) && numCost > 0) {
        if (current.dealerPercentage !== '' && !isNaN(Number(current.dealerPercentage))) {
          const dPct = Number(current.dealerPercentage);
          next.dealerPrice = String(Number((numCost * (1 + dPct / 100)).toFixed(2)));
        } else if (current.dealerPrice !== '' && !isNaN(Number(current.dealerPrice))) {
          const dPrice = Number(current.dealerPrice);
          next.dealerPercentage = String(Number((((dPrice - numCost) / numCost) * 100).toFixed(2)));
        }
        if (current.mrpPercentage !== '' && !isNaN(Number(current.mrpPercentage))) {
          const mPct = Number(current.mrpPercentage);
          next.mrp = String(Number((numCost * (1 + mPct / 100)).toFixed(2)));
        } else if (current.mrp !== '' && !isNaN(Number(current.mrp))) {
          const mPrice = Number(current.mrp);
          next.mrpPercentage = String(Number((((mPrice - numCost) / numCost) * 100).toFixed(2)));
        }
      }
      return next;
    });
  };

  const handleDealerPercentageChange = (val) => {
    const raw = String(val ?? '');
    setForm((current) => {
      const numCost = Number(current.cost || 0);
      const next = { ...current, dealerPercentage: raw };
      if (raw !== '' && !isNaN(Number(raw)) && numCost > 0) {
        next.dealerPrice = String(Number((numCost * (1 + Number(raw) / 100)).toFixed(2)));
      } else if (raw === '') {
        next.dealerPrice = '';
      }
      return next;
    });
  };

  const handleDealerPriceChange = (val) => {
    const raw = String(val ?? '');
    setForm((current) => {
      const numCost = Number(current.cost || 0);
      const next = { ...current, dealerPrice: raw };
      if (raw !== '' && !isNaN(Number(raw)) && numCost > 0) {
        next.dealerPercentage = String(Number((((Number(raw) - numCost) / numCost) * 100).toFixed(2)));
      } else if (raw === '') {
        next.dealerPercentage = '';
      }
      return next;
    });
  };

  const handleMrpPercentageChange = (val) => {
    const raw = String(val ?? '');
    setForm((current) => {
      const numCost = Number(current.cost || 0);
      const next = { ...current, mrpPercentage: raw };
      if (raw !== '' && !isNaN(Number(raw)) && numCost > 0) {
        next.mrp = String(Number((numCost * (1 + Number(raw) / 100)).toFixed(2)));
      } else if (raw === '') {
        next.mrp = '';
      }
      return next;
    });
  };

  const handleMrpChange = (val) => {
    const raw = String(val ?? '');
    setForm((current) => {
      const numCost = Number(current.cost || 0);
      const next = { ...current, mrp: raw };
      if (raw !== '' && !isNaN(Number(raw)) && numCost > 0) {
        next.mrpPercentage = String(Number((((Number(raw) - numCost) / numCost) * 100).toFixed(2)));
      } else if (raw === '') {
        next.mrpPercentage = '';
      }
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (codeError) {
      setError(codeError);
      return;
    }
    const cleanCode = form.code.trim();
    if (!cleanCode) {
      setError('Product code is required.');
      return;
    }
    const cleanCompact = cleanCode.replace(/[^A-Z0-9]/g, '');
    const targetId = existingMatch?.id || form.id || productId;

    const isDup = (data.products || []).some((p) => {
      if (isExistingProduct && (String(p.id) === String(targetId) || String(p.code).trim().toUpperCase() === cleanCode.toUpperCase())) return false;
      const pNorm = String(p.code || '').trim().toUpperCase();
      const pCompact = pNorm.replace(/[^A-Z0-9]/g, '');
      return pNorm === cleanCode.toUpperCase() || (cleanCompact && pCompact === cleanCompact);
    });
    if (isDup) {
      const err = `Product code ${cleanCode} is already in use.`;
      setCodeError(err);
      setError(err);
      return;
    }

    if (!form.categoryId) {
      setError('Please select a category.');
      return;
    }
    if (!form.subcategoryId) {
      setError('Please select a subcategory.');
      return;
    }
    if (costNum <= 0) {
      setError('Purchase Cost must be a valid number greater than 0.');
      return;
    }
    if (dealerPriceError || dealerPriceNum < costNum) {
      setError(dealerPriceError || `The value should be equal or more than ${formattedCost}`);
      return;
    }
    if (mrpError || mrpNum < dealerPriceNum) {
      setError(mrpError || `The value should be equal or more than ${formattedDealer}`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const finalStock = form.stock !== '' && !isNaN(Number(form.stock))
        ? Number(form.stock)
        : (existingMatch ? Number(existingMatch.stock || 0) : 0);
      const finalAlertQuantity = form.alertQuantity !== '' && !isNaN(Number(form.alertQuantity))
        ? Number(form.alertQuantity)
        : (existingMatch ? Number(existingMatch.alertQuantity || 0) : 10);

      let finalSerials = [];
      if (!isCable && form.serialized && !isExistingProduct && finalStock > 0) {
        if (parsedSerials.length === finalStock) {
          const seen = new Set();
          for (const sn of parsedSerials) {
            const snUpper = sn.toUpperCase();
            if (seen.has(snUpper)) {
              setError(`Duplicate serial number "${sn}" entered. Serial numbers must be unique.`);
              setSaving(false);
              return;
            }
            seen.add(snUpper);
          }
          finalSerials = parsedSerials;
        } else if (parsedSerials.length === 0) {
          const code = String(form.code || 'ASI-01').trim().toUpperCase();
          finalSerials = Array.from({ length: finalStock }, (_, i) => `${code}-SN-${1001 + i}`);
        } else {
          setError(`Product is serialized and requires exactly ${finalStock} serial number(s) for opening stock (currently entered: ${parsedSerials.length}).`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        code: form.code.trim(), name: form.name.trim(), description: form.description.trim(), hsnSac: form.hsnSac.trim(),
        productDetails: form.productDetails.trim(), productLink: form.productLink.trim(), categoryId: form.categoryId,
        subcategoryId: form.subcategoryId || null, brandId: form.brandId || null, unit: normalizeUnitValue(form.unit),
        size: '',
        cost: costNum,
        dealerPercentage: dealerPercentageNum,
        dealerPrice: dealerPriceNum,
        mrpPercentage: mrpPercentageNum,
        mrp: mrpNum,
        stock: finalStock,
        alertQuantity: finalAlertQuantity,
        gst: Number(form.gst || 0),
        isIGSTApplicable: Boolean(form.isIGSTApplicable),
        serialized: isCable ? false : Boolean(form.serialized),
        serialNumbers: isCable ? [] : finalSerials
      };
      const isUpdating = Boolean(isExistingProduct && targetId);
      const endpoint = isUpdating ? `/api/stocks/products/${encodeURIComponent(targetId)}` : '/api/stocks/products';
      const method = isUpdating ? 'PUT' : 'POST';
      const response = await apiFetch(apiUrl(endpoint), {
        method, headers: headers(user), body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || `Unable to ${isExistingProduct ? 'update' : 'create'} product.`);
      setSaved(true);
      const savedProd = json.product || json.item || (json.data?.products ? json.data.products.find(p => p.name === form.name.trim() || p.code === form.code.trim()) : json.data);
      if (savedProd && (savedProd.id || savedProd.productId || savedProd.code)) {
        try {
          sessionStorage.setItem('asicrm_newly_created_product_id', savedProd.id || savedProd.productId || savedProd.code);
          sessionStorage.setItem('asicrm_updated_product_payload', JSON.stringify(savedProd));
        } catch (e) {}
      }
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(savedProd);
        } else if (isFromDC) {
          navigate(dcReturnUrl);
        } else if (isFromQuotation) {
          navigate(quotationReturnUrl);
        } else {
          navigate('/stocks/products');
        }
      }, 250);
    } catch (requestError) {
      setError(requestError.message || `Unable to ${isExistingProduct ? 'update' : 'create'} product.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="crm-loading-full"><div className="crm-spinner" /><p>{isExistingProduct ? 'Loading product details...' : 'Loading product setup...'}</p></div>;

  return (
    <div className="product-create-page">
      {error && <div className="crm-alert-box error"><span>{error}</span><button type="button" onClick={() => setError('')} className="close-toast-btn">✕</button></div>}
      {saved && <div className="crm-alert-box success"><span>{isExistingProduct ? 'Product updated successfully.' : 'Product created successfully.'}</span></div>}

      <form className="product-create-card" onSubmit={submit}>
        <div className="product-create-compact-header">
          <div>
            <h1>{isExistingProduct ? 'Edit Product' : 'Add Product'}</h1>
            <p>{isExistingProduct ? 'Manage catalogue, stock and pricing.' : 'Create a new product in the Stock Master.'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isExistingProduct && (
              <button
                type="button"
                className="crm-btn-secondary compact"
                onClick={() => {
                  const targetId = form.id || productId || form.code;
                  navigate(`/stocks/products/${encodeURIComponent(targetId)}/movements`);
                }}
                title="View stock movement history for this product"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  color: '#2563eb',
                  borderColor: '#93c5fd',
                  background: '#eff6ff'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>Stock Movement</span>
              </button>
            )}
            <button type="button" className="crm-btn-secondary compact" onClick={handleBackNavigation} disabled={saving}>
              {isFromDC ? '← Back to Delivery Challan' : (isFromQuotation ? '← Back to Quotation' : '← Back to Products')}
            </button>
          </div>
        </div>
        <section className="product-create-section">
          <div className="product-create-section-heading"><h2>Basic Information</h2></div>
          <div className="product-create-section-body">
            <div className="form-grid-2">
              <Field
                label="Product Code"
                value={form.code}
                onChange={handleCodeChange}
                required
                autoFocus={!isExistingProduct}
                inputRef={codeInputRef}
                disabled={isExistingProduct}
                error={codeError}
                helper={isExistingProduct ? "Permanent product identifier (immutable)" : (codeError ? undefined : "Unique product identifier (e.g. ASI-01)")}
              />
              <Field
                label="Product Name"
                value={form.name}
                onChange={(v) => update('name', v)}
                required
                disabled={isExistingProduct}
              />
              <Field
                label="HSN / SAC Code"
                value={form.hsnSac}
                onChange={(v) => update('hsnSac', v.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))}
                required
                maxLength={8}
                helper="Maximum 8 characters"
                disabled={isExistingProduct}
              />
              <Field
                label="Product Description"
                isTextarea
                rows={3}
                value={form.description}
                onChange={(v) => update('description', v)}
                placeholder="Enter product description"
                disabled={isExistingProduct}
              />
            </div>
          </div>
        </section>

        <section className="product-create-section">
          <div className="product-create-section-heading"><h2>Classification</h2></div>
          <div className="product-create-section-body">
            <div className="form-grid-2">
              <SearchableSelect
                label="Category"
                value={form.categoryId}
                onChange={(v) => setForm((current) => ({ ...current, categoryId: v, subcategoryId: '' }))}
                options={visibleCategories}
                placeholder="Select category"
                searchPlaceholder="Search categories..."
                required
                disabled={isExistingProduct}
                actionButton={
                  !isExistingProduct ? (
                    <button
                      type="button"
                      className="quick-add-link-btn"
                      onClick={() => setQuickModal({ type: 'category', name: '', description: '', saving: false, error: '' })}
                    >
                      + Add Category
                    </button>
                  ) : null
                }
              />
              <SearchableSelect
                label="Subcategory"
                value={form.subcategoryId}
                onChange={(v) => update('subcategoryId', v)}
                options={subcategories}
                placeholder="Select subcategory"
                searchPlaceholder="Search subcategories..."
                required
                disabled={isExistingProduct}
                actionButton={
                  !isExistingProduct ? (
                    <button
                      type="button"
                      className={`quick-add-link-btn${!form.categoryId ? ' disabled' : ''}`}
                      aria-disabled={!form.categoryId}
                      title={!form.categoryId ? 'Select a category first to add subcategory' : 'Add new subcategory for this category'}
                      onClick={() => {
                        if (!form.categoryId) {
                          setError('Please select a Category first to add a Subcategory.');
                          return;
                        }
                        setQuickModal({
                          type: 'subcategory',
                          categoryId: form.categoryId,
                          name: '',
                          description: '',
                          saving: false,
                          error: ''
                        });
                      }}
                    >
                      + Add Subcategory
                    </button>
                  ) : null
                }
              />
              <SearchableSelect
                label="Brand"
                value={form.brandId}
                onChange={(v) => update('brandId', v)}
                options={visibleBrands}
                placeholder="No brand / select brand"
                searchPlaceholder="Search brands..."
                allowEmpty
                disabled={isExistingProduct}
                actionButton={
                  !isExistingProduct ? (
                    <button
                      type="button"
                      className="quick-add-link-btn"
                      onClick={() => setQuickModal({ type: 'brand', name: '', description: '', saving: false, error: '' })}
                    >
                      + Add Brand
                    </button>
                  ) : null
                }
              />
              <Select
                label="Product Unit"
                value={normalizeUnitValue(form.unit)}
                onChange={(v) => update('unit', v)}
                options={unitsList}
                required
                disabled={isExistingProduct}
                actionButton={
                  !isExistingProduct ? (
                    <button
                      type="button"
                      className="quick-add-link-btn"
                      onClick={() => navigate('/settings?section=product-units')}
                      title="Manage Units in Master Settings"
                    >
                      ⚙ Manage Units
                    </button>
                  ) : null
                }
              />
            </div>
          </div>
        </section>

        <section className="product-create-section">
          <div className="product-create-section-heading"><h2>Pricing &amp; Tax</h2></div>
          <div className="product-create-section-body">
            <div className="product-field-grid-4">
              <Field
                label="Purchase Cost"
                type="number"
                min="0"
                step="any"
                value={form.cost}
                onChange={handleCostChange}
                required
                error={costError}
                helper={costError ? undefined : (form.highestInwardRate && Number(form.highestInwardRate) > 0 ? `Benchmark cost (Highest inward: ₹${Number(form.highestInwardRate).toLocaleString('en-IN')})` : "Base purchase cost per unit (Benchmark pegged to highest value)")}
              />
              <Field
                label="Dealer Markup %"
                type="number"
                min="0"
                max="1000"
                step="any"
                value={form.dealerPercentage}
                onChange={handleDealerPercentageChange}
                disabled={costNum <= 0}
                error={dealerPercentageNum < 0 ? 'Markup % cannot be negative' : undefined}
                helper={dealerPriceError ? undefined : (costNum <= 0 ? "Enter Purchase Cost first" : "Markup applied over purchase cost")}
              />
              <Field
                label="Dealer Price"
                type="number"
                min="0"
                step="any"
                value={form.dealerPrice}
                onChange={handleDealerPriceChange}
                required
                disabled={costNum <= 0}
                error={dealerPriceError}
                helper={dealerPriceError ? undefined : (costNum <= 0 ? "Enter Purchase Cost first" : (dealerPercentageNum > 0 ? `${dealerPercentageNum}% markup over cost` : "Selling price to dealer"))}
              />
              <Field
                label="MRP Markup %"
                type="number"
                min="0"
                max="1000"
                step="any"
                value={form.mrpPercentage}
                onChange={handleMrpPercentageChange}
                disabled={!isDealerPriceValid}
                error={mrpPercentageNum < dealerPercentageNum && isDealerPriceValid && form.mrpPercentage !== '' ? `Markup % must be ≥ dealer markup (${dealerPercentageNum}%)` : undefined}
                helper={mrpError ? undefined : (!isDealerPriceValid ? (costNum <= 0 ? "Enter Purchase Cost first" : `Enter valid Dealer Price (≥ ${formattedCost}) first`) : "Markup applied over purchase cost")}
              />
              <Field
                label="MRP"
                type="number"
                min="0"
                step="any"
                value={form.mrp}
                onChange={handleMrpChange}
                required
                disabled={!isDealerPriceValid}
                error={mrpError}
                helper={mrpError ? undefined : (!isDealerPriceValid ? (costNum <= 0 ? "Enter Purchase Cost first" : `Enter valid Dealer Price (≥ ${formattedCost}) first`) : (mrpPercentageNum > 0 ? `${mrpPercentageNum}% markup over cost` : "Maximum Retail Price"))}
              />
              <Field
                label="GST %"
                type="number"
                min="0"
                max="100"
                value={form.gst}
                onChange={(v) => update('gst', v)}
                helper="Total GST Rate"
              />
              <Field
                label="CGST %"
                value={cgst}
                onChange={() => {}}
                disabled
                helper={form.isIGSTApplicable ? 'Inactive (0.00%)' : 'Intra-state (50% of GST)'}
              />
              <Field
                label="SGST %"
                value={sgst}
                onChange={() => {}}
                disabled
                helper={form.isIGSTApplicable ? 'Inactive (0.00%)' : 'Intra-state (50% of GST)'}
              />
              <Field
                label="IGST %"
                value={igst}
                onChange={() => {}}
                disabled
                helper={form.isIGSTApplicable ? 'Active (Inter-state 100%)' : 'Optional / Inactive (0.00%)'}
              />
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: form.isIGSTApplicable ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${form.isIGSTApplicable ? '#93c5fd' : '#e2e8f0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              transition: 'all 0.2s ease'
            }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isIGSTApplicable)}
                  onChange={(e) => update('isIGSTApplicable', e.target.checked)}
                  style={{ accentColor: '#2563eb', width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                    {form.isIGSTApplicable ? 'IGST Applicable (Inter-state Supply)' : 'IGST Applicable (Optional Tax Option)'}
                  </span>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {form.isIGSTApplicable
                      ? 'IGST option enabled (100% tax). CGST & SGST are 0% for inter-state supply.'
                      : 'Standard intra-state taxation: CGST (50%) + SGST (50%). Check to enable IGST.'}
                  </div>
                </div>
              </label>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 10px',
                borderRadius: '6px',
                background: form.isIGSTApplicable ? '#dbeafe' : '#f1f5f9',
                color: form.isIGSTApplicable ? '#1d4ed8' : '#64748b',
                border: `1px solid ${form.isIGSTApplicable ? '#bfdbfe' : '#cbd5e1'}`
              }}>
                {form.isIGSTApplicable ? '✓ IGST ENABLED' : 'CGST + SGST (DEFAULT)'}
              </span>
            </div>
          </div>
        </section>

        <section className="product-create-section">
          <div className="product-create-section-heading"><h2>Stock &amp; Quotation</h2></div>
          <div className="product-create-section-body">
            <div className="form-grid-2">
              <Field
                label={isExistingProduct ? "Current Stock (Units)" : "Opening Stock (Units)"}
                type="number"
                min="0"
                value={form.stock}
                onChange={(v) => update('stock', v)}
                placeholder="e.g. 0, 100"
                helper={isFromQuotation ? "Stock is optional for quotations. Inventory outward occurs during Delivery Challan & Invoice." : (isExistingProduct ? "Current inventory count. Enter updated stock level to adjust inventory." : "Initial inventory count added to stock upon product creation.")}
                disabled={false}
              />
              <Field
                label="Alert / Minimum Stock Quantity"
                type="number"
                min="0"
                value={form.alertQuantity}
                onChange={(v) => update('alertQuantity', v)}
                placeholder="e.g. 10"
                helper="Triggers Low Stock warning when available stock falls to or below this level."
                disabled={false}
              />
              <Field
                label="Product Details for Quotation"
                value={form.productDetails}
                onChange={(v) => update('productDetails', v)}
                disabled={isExistingProduct}
              />
              <Field
                label="Product Link"
                value={form.productLink}
                onChange={(v) => update('productLink', v)}
                disabled={isExistingProduct}
              />
              <div className="form-field-group" style={{ gridColumn: 'span 2' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: (isExistingProduct || isCable) ? 'not-allowed' : 'pointer', opacity: (isExistingProduct || isCable) ? 0.75 : 1 }}>
                  <input
                    type="checkbox"
                    checked={!isCable && Boolean(form.serialized)}
                    onChange={(e) => !isExistingProduct && !isCable && update('serialized', e.target.checked)}
                    disabled={isExistingProduct || isCable}
                    style={{ width: '16px', height: '16px', cursor: (isExistingProduct || isCable) ? 'not-allowed' : 'pointer' }}
                  />
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Serialized Inventory Tracking</span>
                  {isCable && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginLeft: '8px',
                      padding: '2px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca'
                    }}>
                      Disabled for Cables (No Serial Numbers)
                    </span>
                  )}
                </label>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', marginLeft: '24px' }}>
                  {isCable
                    ? 'Cables cannot have serial numbers. All cable inventory is strictly quantity and length-based.'
                    : form.serialized
                    ? 'Track individual units by unique computer-generated or manual serial numbers for loading products, stock in, goods receipt, delivery challans, and returns.'
                    : 'Standard quantity-based inventory. No serial numbers will be requested or stored for this product.'}
                </div>
              </div>

              {!isCable && form.serialized && !isExistingProduct && Number(form.stock) > 0 && (
                <div className="form-field-group" style={{
                  gridColumn: 'span 2',
                  marginTop: '4px',
                  padding: '16px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Serial Numbers for Opening Stock ({Number(form.stock)} Required)
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: parsedSerials.length === Number(form.stock) ? '#dcfce7' : '#fef3c7',
                        color: parsedSerials.length === Number(form.stock) ? '#15803d' : '#b45309'
                      }}>
                        {parsedSerials.length} / {Number(form.stock)} Entered
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoGenerateSerials}
                      className="crm-btn-secondary compact"
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#eff6ff',
                        borderColor: '#93c5fd',
                        color: '#1d4ed8'
                      }}
                    >
                      ⚡ Auto-Generate Serial Numbers
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0' }}>
                    Enter serial numbers manually (one per line or comma-separated) or click <strong>Auto-Generate</strong> for computer-generated serial numbers.
                  </p>
                  <textarea
                    rows={4}
                    value={serialNumbersText}
                    onChange={(e) => setSerialNumbersText(e.target.value)}
                    placeholder={`${form.code || 'ASI-01'}-SN-1001\n${form.code || 'ASI-01'}-SN-1002\n...`}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="product-create-actions">
          <button type="button" className="crm-btn-secondary" onClick={handleBackNavigation} disabled={saving}>
            {isFromDC ? '← Back to Delivery Challan' : (isFromQuotation ? '← Back to Quotation' : 'Cancel')}
          </button>
          <button type="submit" className="crm-btn-primary" disabled={saving || saved || Boolean(codeError) || Boolean(costError) || Boolean(dealerPriceError) || Boolean(mrpError)}>
            {saving
              ? (isExistingProduct ? 'Saving...' : 'Creating...')
              : (isExistingProduct ? 'Save & Update' : 'Create Product')}
          </button>
        </div>
      </form>

      {quickModal && (
        <QuickAddModal
          modal={quickModal}
          onClose={() => !quickModal.saving && setQuickModal(null)}
          onChangeField={(field, val) => setQuickModal((prev) => (prev ? { ...prev, [field]: val } : null))}
          onSave={handleQuickSave}
          visibleCategories={visibleCategories}
        />
      )}
    </div>
  );

}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  min,
  max,
  step,
  maxLength,
  disabled = false,
  helper = '',
  error = '',
  autoFocus = false,
  inputRef,
  isTextarea = false,
  rows = 3,
  placeholder = '',
  onKeyDown,
  inputMode
}) {
  return (
    <div className="form-field-group">
      <label className="field-label">{label}{required && <span className="req-star"> *</span>}</label>
      {isTextarea ? (
        <textarea
          ref={inputRef}
          autoFocus={autoFocus}
          className="crm-text-input product-description-textarea"
          rows={rows}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          style={{
            ...(error ? { borderColor: '#ef4444' } : {}),
            ...(disabled ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {})
          }}
        />
      ) : (
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          className="crm-text-input"
          type={type}
          min={min}
          max={max}
          step={step || (type === 'number' ? 'any' : undefined)}
          maxLength={maxLength}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          inputMode={inputMode}
          style={{
            ...(error ? { borderColor: '#ef4444' } : {}),
            ...(disabled ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {})
          }}
        />
      )}
      {error ? (
        <small className="field-error" style={{ color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '4px' }}>
          {error}
        </small>
      ) : (
        helper && <small className="field-helper">{helper}</small>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder, required = false, disabled = false, actionButton = null }) {
  return (
    <div className="form-field-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label className="field-label" style={{ marginBottom: 0 }}>{label}{required && <span className="req-star"> *</span>}</label>
        {actionButton}
      </div>
      <select
        className="crm-select-input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        style={disabled ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select>
    </div>
  );
}

function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  searchPlaceholder = 'Search options...',
  required = false,
  allowEmpty = false,
  actionButton = null,
  disabled = false
}) {
  const wrapperRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const optionsContainerRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const selected = options.find((item) => String(item.id) === String(value));
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [options, search]);

  const displayOptions = React.useMemo(() => {
    if (allowEmpty && !search.trim()) {
      return [{ id: '', name: placeholder, isClearOption: true }, ...filtered];
    }
    return filtered;
  }, [allowEmpty, search, placeholder, filtered]);

  React.useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  React.useEffect(() => {
    if (open) {
      const initialIdx = displayOptions.findIndex((item) => String(item.id) === String(value));
      setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
      inputRef.current?.focus();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    } else {
      setSearch('');
    }
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
    }
  }, [search]);

  React.useEffect(() => {
    if (open && optionsContainerRef.current) {
      const el = optionsContainerRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, open]);

  const choose = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setSearch('');
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (displayOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % displayOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (displayOptions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + displayOptions.length) % displayOptions.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (displayOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < displayOptions.length) {
        choose(displayOptions[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`form-field-group searchable-select${open ? ' is-open' : ''}`} ref={wrapperRef}>
      <div className="searchable-select-label-row">
        <label className="field-label">
          {label}{required && <span className="req-star"> *</span>}
        </label>
        {actionButton}
      </div>
      <button
        ref={triggerRef}
        type="button"
        className="crm-select-input searchable-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        style={disabled ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : undefined}
      >
        <span className={selected ? 'searchable-select-value' : 'searchable-select-placeholder'}>
          {selected?.name || placeholder}
        </span>
        <span className="searchable-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div className="searchable-select-menu" role="listbox">
          <div className="searchable-select-search">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          <div className="searchable-select-options" ref={optionsContainerRef}>
            {!displayOptions.length ? (
              <div className="searchable-select-empty">No options found.</div>
            ) : (
              displayOptions.map((item, index) => {
                const isSelected = String(item.id) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    type="button"
                    key={item.id || 'empty-opt'}
                    data-index={index}
                    className={`searchable-select-option${isSelected ? ' selected' : ''}${isHighlighted ? ' highlighted' : ''}`}
                    onClick={() => choose(item.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {item.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

function QuickAddModal({ modal, onClose, onChangeField, onSave, visibleCategories }) {
  if (!modal) return null;

  const { type, categoryId, name, description, saving, error } = modal;
  const isCategory = type === 'category';
  const isSubcategory = type === 'subcategory';
  const isBrand = type === 'brand';

  const title = isCategory ? 'Add Category' : isSubcategory ? 'Add Subcategory' : 'Add Brand';
  const subtitle = isCategory
    ? 'Create a new product category in Stock Master.'
    : isSubcategory
    ? 'Create a new subcategory linked to the selected parent category.'
    : 'Create a new manufacturer or brand in Stock Master.';

  const parentCat = isSubcategory
    ? visibleCategories.find((c) => c.id === categoryId)
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isSubcategory && !categoryId) return;
    onSave();
  };

  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="crm-modal-card settings-modal-card stock-quick-modal-card" role="dialog" aria-modal="true">
        <div className="crm-modal-header">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button className="crm-modal-close" type="button" onClick={onClose} disabled={saving} aria-label="Close modal">×</button>
        </div>

        <form onSubmit={handleSubmit} className="settings-modal-form stock-form-v3">
          {error && (
            <div className="crm-alert-box error stock-modal-alert">
              <span>{error}</span>
            </div>
          )}

          {isSubcategory && (
            <div className="form-field-group">
              <label className="field-label">Parent Category</label>
              <input
                className="crm-text-input"
                type="text"
                value={parentCat ? parentCat.name : '(No category selected)'}
                disabled
                readOnly
              />
              <small className="field-helper">New subcategory will be assigned to this category</small>
            </div>
          )}

          <div className="form-field-group">
            <label className="field-label">
              {isCategory ? 'Category Name' : isSubcategory ? 'Subcategory Name' : 'Brand Name'}
              <span className="req-star"> *</span>
            </label>
            <input
              autoFocus
              className="crm-text-input"
              type="text"
              value={name}
              onChange={(e) => onChangeField('name', e.target.value)}
              placeholder={`Enter ${isCategory ? 'category' : isSubcategory ? 'subcategory' : 'brand'} name`}
              required
              disabled={saving}
            />
          </div>

          <div className="form-field-group">
            <label className="field-label">Description</label>
            <input
              className="crm-text-input"
              type="text"
              value={description}
              onChange={(e) => onChangeField('description', e.target.value)}
              placeholder="Optional description"
              disabled={saving}
            />
          </div>

          <div className="settings-modal-actions">
            <button type="button" className="crm-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="crm-btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : `Create ${isCategory ? 'Category' : isSubcategory ? 'Subcategory' : 'Brand'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

