import React from 'react';
import {
  Building2,
  MapPin,
  GitBranch,
  Warehouse,
  FileText,
  FileSpreadsheet,
  Truck,
  Printer,
  Mail,
  MessageSquare,
  CreditCard,
  DollarSign,
  Receipt,
  Percent,
  Users,
  Shield,
  KeyRound,
  Image,
  Search,
  ArrowLeft,
  Package
} from 'lucide-react';
import { filterRecordsBySearch } from '../../utils/searchHelper';

export const SETTINGS_CATEGORIES = [
  {
    id: 'general',
    label: 'GENERAL',
    items: [
      { id: 'company-profile', label: 'Company Profile', icon: Building2, desc: 'Enterprise profile, legal details, base terms' },
      { id: 'locations', label: 'Location & Address', icon: MapPin, desc: 'Operating sites, registered addresses' },
      { id: 'branches', label: 'Branches', icon: GitBranch, desc: 'Commercial divisions, regional branches' },
      { id: 'warehouses', label: 'Warehouses', icon: Warehouse, desc: 'Fulfillment centers, godowns' },
      { id: 'product-units', label: 'Product Units', icon: Package, desc: 'Measurement units, default unit, unit codes' }
    ]
  },
  {
    id: 'documents',
    label: 'DOCUMENTS',
    items: [
      { id: 'invoice-setup', label: 'Invoice Setup', icon: FileText, desc: 'Sequence, layout, terms' },
      { id: 'quotation-setup', label: 'Quotation Setup', icon: FileSpreadsheet, desc: 'Quote series, validity, rules' },
      { id: 'dc-setup', label: 'Delivery Challan Setup', icon: Truck, desc: 'DC series, returnable conditions' },
      { id: 'pdf-settings', label: 'PDF / Print Settings', icon: Printer, desc: 'Page size, margins, accent color' }
    ]
  },
  {
    id: 'communication',
    label: 'COMMUNICATION',
    items: [
      { id: 'email-setup', label: 'Email Setup', icon: Mail, desc: 'SMTP gateway, sender defaults' },
      { id: 'sms-settings', label: 'SMS Settings', icon: MessageSquare, desc: 'SMS gateway, DLT, alert triggers' }
    ]
  },
  {
    id: 'finance',
    label: 'FINANCE',
    items: [
      { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard, desc: 'Accepted payment channels, bank accounts' },
      { id: 'currency', label: 'Currency', icon: DollarSign, desc: 'Base currency, formatting precision' },
      { id: 'tax-gst', label: 'Tax / GST', icon: Receipt, desc: 'GST slabs, HSN, E-Way thresholds' },
      { id: 'discount-settings', label: 'Discount Settings', icon: Percent, desc: 'Max discount caps, approval threshold' }
    ]
  },
  {
    id: 'organization',
    label: 'ORGANIZATION & ACCESS',
    items: [
      { id: 'users', label: 'Users', icon: Users, desc: 'Staff accounts, role assignments' },
      { id: 'roles', label: 'Roles', icon: Shield, desc: 'Access tiers, group administration' },
      { id: 'permissions', label: 'Permissions', icon: KeyRound, desc: 'Module action matrices' }
    ]
  },
  {
    id: 'branding',
    label: 'BRANDING',
    items: [
      { id: 'branding', label: 'Company Logo & Brand', icon: Image, desc: 'Master logo, signature, official stamp' }
    ]
  }
];

export default function SettingsLayout({
  activeSection,
  onSelectSection,
  hasUnsavedChanges,
  onSaveActiveSection,
  isSaving,
  searchQuery,
  onSearchChange,
  onBack,
  children
}) {
  // Find current item and category for breadcrumbs
  let currentCategory = null;
  let currentItem = null;

  for (const cat of SETTINGS_CATEGORIES) {
    const found = cat.items.find((item) => item.id === activeSection);
    if (found) {
      currentCategory = cat;
      currentItem = found;
      break;
    }
  }

  return (
    <div className="settings-module-container">
      {/* SETTINGS TOP HEADER BAR */}
      <header className="settings-header-bar">
        <div className="settings-header-left">
          <div className="settings-breadcrumbs">
            <span className="crumb-link" onClick={() => onSelectSection('company-profile')}>
              Settings
            </span>
            <span className="crumb-sep">/</span>
            <span>{currentCategory?.label || 'General'}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{currentItem?.label || 'Company Profile'}</span>
          </div>
          <div className="settings-title-row">
            {onBack && (
              <button
                type="button"
                className="settings-back-btn"
                onClick={onBack}
                title="Return to previous page"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}
            <h1 className="settings-page-title">{currentItem?.label || 'Company Settings'}</h1>
          </div>
        </div>

        <div className="settings-header-right">
          {/* Quick Search */}
          <div className="settings-search-wrapper" style={{ position: 'relative' }}>
            <Search className="settings-search-icon" size={15} />
            <input
              type="text"
              className="settings-search-input"
              placeholder="Search all settings..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ paddingRight: searchQuery ? '28px' : undefined }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                title="Clear search"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Badge */}
          {hasUnsavedChanges ? (
            <span className="settings-status-badge unsaved">
              <span className="settings-status-dot" />
              Unsaved Changes
            </span>
          ) : (
            <span className="settings-status-badge saved">
              <span className="settings-status-dot" />
              ✓ All Changes Saved
            </span>
          )}

          {/* Save Button */}
          {onSaveActiveSection && (
            <button
              type="button"
              className="settings-header-save-btn"
              onClick={onSaveActiveSection}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </header>

      {/* WORKSPACE LAYOUT (SIDEBAR + CONTENT) */}
      <div className="settings-workspace-layout">
        {/* COMPACT LEFT SIDEBAR */}
        <aside className="settings-sidebar">
          {SETTINGS_CATEGORIES.map((cat) => {
            // Filter by search query if present
            const matchingItems = filterRecordsBySearch(cat.items, searchQuery, [
              (item) => item.label,
              (item) => item.desc
            ]);

            if (matchingItems.length === 0) return null;

            return (
              <div key={cat.id} className="settings-nav-group">
                <div className="settings-group-header">
                  <span>{cat.label}</span>
                </div>
                {matchingItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === activeSection;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`settings-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectSection(item.id)}
                      title={item.desc}
                    >
                      <span className="settings-nav-btn-icon">
                        <Icon size={16} />
                      </span>
                      <span className="settings-nav-btn-label">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>

        {/* MAIN SETTINGS CONTENT VIEWPORT */}
        <main className="settings-content-viewport">
          {children}
        </main>
      </div>
    </div>
  );
}
