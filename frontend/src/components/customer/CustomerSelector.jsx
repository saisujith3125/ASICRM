import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import { X, UserPlus, Search, User, ChevronDown } from 'lucide-react';
import AddCustomerModal from './AddCustomerModal';
import { contactPersonOf } from '../../utils/crmDisplay';
import { apiFetch, apiUrl } from '../../api';
import '../common/searchableProductSelect.css';

/**
 * CustomerSelector
 *
 * Direct type-to-search typeahead combobox for Customer selection.
 * Features:
 * - Live filtering across Name, Company, Contact Person, Mobile, Email, and City.
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab).
 * - Single autocomplete open management with 'crm-autocomplete-opened'.
 * - Prominent, compact "+ Add New Customer" action button.
 * - Full modal integration with duplicate prevention and auto-selection.
 * - Real-time synchronization across the CRM via 'crm-customer-created' events.
 */
export default function CustomerSelector({
  selectedCustomerId = '',
  selectedCustomerData = null,
  onSelectCustomer,
  onViewCustomer,
  required = true,
  disabled = false,
  allowCreate = true,
  label = 'Select Customer',
  placeholder = 'Search customer name, phone, company, or city...',
  showSummaryTable = false,
  compact = false,
  className = '',
  displayMode = 'default',
  hideEmptyState = true,
  hideToast = true
}) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalName, setInitialModalName] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const instanceId = useId();

  // Load customer directory from API
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(apiUrl('/api/customers'));
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load customers in CustomerSelector:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Listen for global customer creation events from anywhere in the CRM
  useEffect(() => {
    const handleGlobalCreated = (e) => {
      const newCust = e.detail?.customer;
      if (newCust && newCust.id) {
        setCustomers((prev) => {
          if (prev.some((c) => c.id === newCust.id)) return prev;
          return [newCust, ...prev];
        });
      }
    };

    window.addEventListener('crm-customer-created', handleGlobalCreated);
    return () => {
      window.removeEventListener('crm-customer-created', handleGlobalCreated);
    };
  }, []);

  const isNameOnly = displayMode === 'name-only' || displayMode === 'nameOnly';

  // Find currently selected customer
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId) {
      const found = customers.find((c) => c.id === selectedCustomerId);
      if (found) return found;
    }
    return selectedCustomerData || null;
  }, [customers, selectedCustomerId, selectedCustomerData]);

  // Format label for display: "Customer Name (Company Name)" or "Customer Name"
  const formatCustomerLabel = (cust) => {
    if (!cust) return '';
    const rawName = String(cust.name || '').trim();
    const rawComp = String(cust.company || '').trim();

    if (rawName && rawComp && rawComp.toLowerCase() !== rawName.toLowerCase()) {
      return `${rawName} (${rawComp})`;
    }
    return rawName || rawComp || '';
  };

  // Keep displayValue synced with selectedCustomer when not actively typing
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(formatCustomerLabel(selectedCustomer));
    }
  }, [selectedCustomer, isEditing]);

  // Helper to match token against a field value with word-boundary awareness
  const fieldMatchesToken = (val, token) => {
    if (!val) return false;
    const s = String(val).trim().toLowerCase();
    if (!s) return false;

    // Numeric search (phone, pin, id)
    if (/^\d+$/.test(token)) {
      return s.includes(token);
    }

    // Short token (<= 3 chars, e.g. "rk", "asi")
    // Require token to match at the beginning of a word to avoid false positives (e.g. "rk" in "York", "Workflow", "Park")
    if (token.length <= 3) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`(?:^|[\\s.,_\\-\\/])${escaped}`, 'i');
      if (wordBoundaryRegex.test(s)) return true;

      // Check for dotted abbreviations where the constituent words are single characters (e.g. "R. K." or "R.K.")
      const words = s.split(/[\s.,_\-\/]+/).filter(Boolean);
      const isAbbrev = words.length >= token.length && words.slice(0, token.length).every((w) => w.length === 1);
      if (isAbbrev) {
        const initials = words.slice(0, token.length).map((w) => w[0]).join('').toLowerCase();
        if (initials === token) return true;
      }

      return false;
    }

    // Longer tokens (> 3 chars)
    return s.includes(token);
  };

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);

    const tokens = q.split(/\s+/).filter(Boolean);

    const matched = customers.filter((c) => {
      const name = String(c.name || '');
      const comp = String(c.company || '');
      if (isNameOnly) {
        return tokens.every((token) => fieldMatchesToken(name, token) || fieldMatchesToken(comp, token));
      }

      const mobile = String(c.mobile || c.phone || '');
      const city = String(c.city || '');
      const contact = String(c.contactPerson || '');
      const id = String(c.id || '');

      const fields = [name, comp, mobile, city, contact, id];
      return tokens.every((token) => fields.some((field) => fieldMatchesToken(field, token)));
    });

    // Prefer customer-name / company relevance first
    return matched.sort((a, b) => {
      const aName = tokens.some((t) => fieldMatchesToken(a.name, t) || fieldMatchesToken(a.company, t));
      const bName = tokens.some((t) => fieldMatchesToken(b.name, t) || fieldMatchesToken(b.company, t));
      if (aName && !bName) return -1;
      if (!aName && bName) return 1;
      return 0;
    }).slice(0, 20);
  }, [customers, searchQuery, isNameOnly]);

  // Reset highlight index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCustomers]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listboxRef.current) {
      const highlightedEl = listboxRef.current.children[highlightedIndex];
      if (highlightedEl && typeof highlightedEl.scrollIntoView === 'function') {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle outside click & single-open coordination
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatCustomerLabel(selectedCustomer));
      }
    };

    const handleOtherOpened = (e) => {
      if (e.detail?.id !== instanceId) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatCustomerLabel(selectedCustomer));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
    };
  }, [isOpen, instanceId, selectedCustomer]);

  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    window.dispatchEvent(
      new CustomEvent('crm-autocomplete-opened', { detail: { id: instanceId } })
    );
  };

  const handleSelect = (customer) => {
    if (!customer) return;
    if (onSelectCustomer) {
      onSelectCustomer(customer.id, customer);
    }
    setDisplayValue(formatCustomerLabel(customer));
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (disabled) return;
    setDisplayValue('');
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
    if (onSelectCustomer) {
      onSelectCustomer('', null);
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else {
        setHighlightedIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, filteredCustomers.length - 1)));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredCustomers.length > 0) {
        const target = filteredCustomers[highlightedIndex] || filteredCustomers[0];
        if (target) {
          handleSelect(target);
        }
      } else if (!isOpen) {
        openDropdown();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsEditing(false);
      setSearchQuery('');
      setDisplayValue(formatCustomerLabel(selectedCustomer));
    } else if (e.key === 'Tab') {
      if (isOpen) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatCustomerLabel(selectedCustomer));
      }
    }
  };

  // Handler when a new customer is successfully created from modal
  const handleCustomerCreated = (newCustomer) => {
    setCustomers((prev) => [newCustomer, ...prev.filter((c) => c.id !== newCustomer.id)]);
    if (onSelectCustomer) {
      onSelectCustomer(newCustomer.id, newCustomer);
    }
    setDisplayValue(formatCustomerLabel(newCustomer));
    setSearchQuery('');
    setIsEditing(false);
    setIsModalOpen(false);
  };

  // Handler when user chooses to use existing customer from duplicate prompt
  const handleSelectExisting = (existingCustomer) => {
    if (onSelectCustomer) {
      onSelectCustomer(existingCustomer.id, existingCustomer);
    }
    setDisplayValue(formatCustomerLabel(existingCustomer));
    setSearchQuery('');
    setIsEditing(false);
    setIsModalOpen(false);
  };

  const openAddModalWithQuery = (queryText = '') => {
    setInitialModalName(queryText);
    setIsModalOpen(true);
    setIsOpen(false);
  };

  return (
    <div className={`crm-customer-selector-wrapper ${className}`} ref={containerRef}>

      {/* Label and '+ Add New Customer' button */}
      {!compact && (
        <div className="customer-selector-header-row">
          {label && (
            <label className="field-label prominent">
              {label} {required && <span className="req-star">*</span>}
            </label>
          )}

          {allowCreate && (
            <button
              type="button"
              onClick={() => openAddModalWithQuery(searchQuery)}
              className="add-new-customer-trigger-btn"
              disabled={disabled}
              title="Add a new customer to CRM"
            >
              <UserPlus size={14} strokeWidth={2.5} />
              <span>+ Add New Customer</span>
            </button>
          )}
        </div>
      )}

      {/* Direct Typeahead Input Box */}
      <div className="scs-input-container">
        <div
          className={`sps-input-trigger-wrapper ${isOpen ? 'is-focused' : ''} ${disabled ? 'is-disabled' : ''}`}
          onClick={() => {
            if (!disabled && inputRef.current) {
              inputRef.current.focus();
            }
          }}
          style={{ height: '36px', minHeight: '36px' }}
        >
          <Search size={14} className="sps-empty-icon" style={{ marginRight: '6px', color: '#94a3b8' }} />

          <input
            ref={inputRef}
            type="text"
            className="sps-direct-input"
            value={isEditing ? searchQuery : displayValue}
            placeholder={loading ? 'Loading customers...' : placeholder}
            disabled={disabled}
            onFocus={() => {
              if (selectedCustomer && inputRef.current) {
                inputRef.current.select();
              } else {
                setIsEditing(true);
              }
            }}
            onClick={() => {
              if (!isEditing && selectedCustomer && inputRef.current) {
                inputRef.current.select();
              }
            }}
            onChange={(e) => {
              const val = e.target.value;
              setIsEditing(true);
              setSearchQuery(val);
              if (val.trim().length > 0) {
                if (!isOpen) openDropdown();
              } else {
                setIsOpen(false);
              }
            }}
            onKeyDown={handleKeyDown}
            style={{ fontSize: '13px' }}
            autoComplete="off"
            spellCheck="false"
          />

          <div className="sps-input-actions">
            {(displayValue || searchQuery || selectedCustomer) && !disabled && (
              <button
                type="button"
                className="sps-clear-btn"
                onClick={handleClear}
                tabIndex={-1}
                title="Clear selection"
                aria-label="Clear customer"
              >
                <X size={14} />
              </button>
            )}
            <div
              className={`sps-action-btn sps-chevron ${isOpen ? 'rotate' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                if (isOpen) {
                  setIsOpen(false);
                  setIsEditing(false);
                  setDisplayValue(formatCustomerLabel(selectedCustomer));
                } else {
                  if (inputRef.current) inputRef.current.focus();
                  setIsEditing(true);
                  openDropdown();
                }
              }}
              role="button"
              tabIndex={-1}
              title={isOpen ? "Close dropdown" : "Show customers"}
            >
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* Dropdown Options Menu */}
        {isOpen && !disabled && (
          <ul className={`scs-dropdown-list ${isNameOnly ? 'is-name-only' : ''}`} ref={listboxRef} role="listbox">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((cust, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const isSelected = selectedCustomer?.id === cust.id;
                const custName = String(cust.name || '').trim();
                const compName = String(cust.company || '').trim();
                const hasDistinctComp = compName && custName && compName.toLowerCase() !== custName.toLowerCase();

                return (
                  <li
                    key={cust.id}
                    className={`scs-option-item ${isHighlighted ? 'is-highlighted' : ''} ${isSelected ? 'is-selected' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(cust);
                    }}
                    onClick={() => handleSelect(cust)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', lineHeight: 1.3 }}>
                          {custName || compName || '—'}
                        </div>
                        {hasDistinctComp && (
                          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.25 }}>
                            {compName}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                          ✓ Selected
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="scs-no-results">
                <div className="scs-no-results-text">No customers found</div>
                {allowCreate && !isNameOnly && (
                  <button
                    type="button"
                    className="scs-add-shortcut-btn"
                    onClick={() => openAddModalWithQuery(searchQuery)}
                  >
                    + Add "{searchQuery.trim() || 'New Customer'}"
                  </button>
                )}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Add Customer Modal */}
      {allowCreate && (
        <AddCustomerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCustomerCreated={handleCustomerCreated}
          onSelectExistingCustomer={handleSelectExisting}
          existingCustomers={customers}
          defaultName={initialModalName}
        />
      )}
    </div>
  );
}