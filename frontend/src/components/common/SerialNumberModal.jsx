import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Barcode, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

/**
 * SerialNumberModal
 *
 * Dedicated enterprise modal for entering and validating serial numbers for serialized hardware.
 * - Header hierarchy: "Serial Numbers" > Product Name > SKU.
 * - Large responsive monospace textarea supporting one-per-line and comma-separated inputs.
 * - Live dynamic counter: "Entered: X / Y" with color-coded completeness states.
 * - Exact-count validation: Save button strictly enabled when entered.length === requiredCount and no duplicates.
 * - Internal duplicate detection with descriptive warnings.
 * - Restores focus to the trigger element upon closing.
 */
export default function SerialNumberModal({
  isOpen,
  onClose,
  onSave,
  product,
  requiredCount = 0,
  initialSerials = [],
  triggerRef
}) {
  const [text, setText] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const textareaRef = useRef(null);

  // Initialize or reset text when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = Array.isArray(initialSerials) ? initialSerials.join('\n') : '';
      setText(initial);
      setHasInteracted(false);

      // Autofocus textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, initialSerials]);

  // Restore focus to trigger on close
  const handleClose = () => {
    onClose();
    if (triggerRef && triggerRef.current) {
      setTimeout(() => {
        triggerRef.current?.focus();
      }, 50);
    }
  };

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Parse and normalize serial numbers
  const parsedSerials = useMemo(() => {
    if (!text) return [];
    return text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [text]);

  // Check for duplicates in entered serials
  const duplicateInfo = useMemo(() => {
    const seen = new Map();
    for (const s of parsedSerials) {
      const lower = s.toLowerCase();
      if (seen.has(lower)) {
        return { hasDuplicate: true, duplicateValue: s };
      }
      seen.set(lower, s);
    }
    return { hasDuplicate: false, duplicateValue: null };
  }, [parsedSerials]);

  const count = parsedSerials.length;
  const isCountExact = count === requiredCount && requiredCount > 0;
  const isCountOver = count > requiredCount;
  const isCountUnder = count < requiredCount;
  const isValid = isCountExact && !duplicateInfo.hasDuplicate;

  const handleSave = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onSave(parsedSerials);
    handleClose();
  };

  if (!isOpen) return null;

  const productName = product?.productName || product?.name || 'Serialized Hardware';
  const productCode = product?.productCode || product?.code || product?.sku || 'SKU-001';

  const modalContent = (
    <div
      className="crm-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        // Prevent accidental loss: only close if clicked on backdrop AND no changes made
        if (e.target === e.currentTarget && (!hasInteracted || text.trim() === '')) {
          handleClose();
        }
      }}
    >
      <div
        className="crm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="serial-modal-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '650px',
          maxHeight: '82vh',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          zIndex: 2010,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              id="serial-modal-title"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}
            >
              <Barcode size={20} style={{ color: '#2563eb' }} />
              Serial Numbers
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#1e293b',
                marginTop: '2px'
              }}
            >
              {productName}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontFamily: 'monospace',
                marginTop: '1px'
              }}
            >
              SKU: {productCode}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '-2px',
              transition: 'background 0.15s ease, color 0.15s ease'
            }}
            title="Close (Escape)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Instructions Box */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <div
              style={{
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                borderRadius: '6px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Barcode size={18} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                Required:{' '}
                <span style={{ color: '#2563eb' }}>
                  {requiredCount} serial number{requiredCount === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Enter one serial number per line or separate multiple values with commas.
              </div>
            </div>
          </div>

          {/* Validation Warnings */}
          {duplicateInfo.hasDuplicate && (
            <div
              className="crm-alert crm-alert-danger"
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                Duplicate serial number detected:{' '}
                <strong>"{duplicateInfo.duplicateValue}"</strong>. All serials must be unique.
              </span>
            </div>
          )}

          {/* Textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                htmlFor="serial-textarea-input"
                style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}
              >
                Serial Numbers List:
              </label>
              {requiredCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const prefix = String(productCode || 'PROD').trim().toUpperCase();
                    const generated = Array.from({ length: requiredCount }, (_, i) => `${prefix}-SN-${1001 + i}`);
                    setText(generated.join('\n'));
                    setHasInteracted(true);
                  }}
                  className="crm-btn-secondary compact"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#eff6ff',
                    borderColor: '#93c5fd',
                    color: '#1d4ed8',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  title="Automatically generate sequential computer serial numbers"
                >
                  ⚡ Auto-Generate Serial Numbers
                </button>
              )}
            </div>
            <textarea
              id="serial-textarea-input"
              ref={textareaRef}
              rows={8}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setHasInteracted(true);
              }}
              placeholder={`CAM-SN-1001\nCAM-SN-1002\nCAM-SN-1003`}
              style={{
                width: '100%',
                minHeight: '180px',
                padding: '12px 14px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '13.5px',
                lineHeight: '1.5',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: `1.5px solid ${
                  duplicateInfo.hasDuplicate
                    ? '#ef4444'
                    : isCountExact
                    ? '#16a34a'
                    : '#cbd5e1'
                }`,
                borderRadius: '8px',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
            />
          </div>

          {/* Dynamic Status / Progress Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: isCountExact
                ? '#ecfdf5'
                : isCountOver
                ? '#fef2f2'
                : '#f8fafc',
              border: `1px solid ${
                isCountExact
                  ? '#a7f3d0'
                  : isCountOver
                  ? '#fecaca'
                  : '#e2e8f0'
              }`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isCountExact ? (
                <CheckCircle2 size={18} style={{ color: '#059669' }} />
              ) : isCountOver ? (
                <AlertCircle size={18} style={{ color: '#dc2626' }} />
              ) : (
                <Barcode size={18} style={{ color: '#64748b' }} />
              )}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isCountExact
                    ? '#065f46'
                    : isCountOver
                    ? '#991b1b'
                    : '#334155'
                }}
              >
                Entered: {count} / {requiredCount}
              </span>
            </div>

            <div style={{ fontSize: '12.5px', fontWeight: 500 }}>
              {isCountExact ? (
                <span style={{ color: '#059669' }}>✓ Complete &amp; ready to save</span>
              ) : isCountOver ? (
                <span style={{ color: '#dc2626' }}>
                  ⚠️ {count - requiredCount} excess serial{count - requiredCount === 1 ? '' : 's'} entered
                </span>
              ) : (
                <span style={{ color: '#64748b' }}>
                  {requiredCount - count} remaining
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={handleClose}
            style={{ padding: '8px 18px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={handleSave}
            disabled={!isValid}
            style={{
              padding: '8px 20px',
              opacity: isValid ? 1 : 0.5,
              cursor: isValid ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={16} />
            Save Serial Numbers
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
