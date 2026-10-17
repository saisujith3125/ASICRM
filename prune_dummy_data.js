const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'backend', 'data');
const crmPath = path.join(dataDir, 'crm-data.json');
const stocksPath = path.join(dataDir, 'stocks-data.json');

console.log('--- EXECUTING CONTROLLED DUMMY DATA CLEANUP ---');

// 1. Build Golden Seed CRM Data
const goldenCrmData = {
  customers: [
    {
      id: 'CUST-000001',
      name: 'Apex Technologies Pvt Ltd',
      mobile: '9840123456',
      email: 'karthik@apextech.in',
      contactPerson: 'Karthik Ramanathan',
      company: 'Apex Technologies Pvt Ltd',
      customerType: 'Corporate',
      address: 'Apex Towers, No. 45, Anna Salai, Guindy',
      shippingAddress: 'Apex Technology Center, MEPZ-SEZ, Tambaram, Chennai - 600045',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600032',
      gstin: '33AAACA1234A1Z5',
      notes: 'Premium enterprise client for surveillance and security infrastructure.',
      branches: [],
      requirements: 'Enterprise Dahua IP Surveillance Systems',
      status: 'Active',
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:00:00.000Z'
    }
  ],
  enquiries: [
    {
      enquiryId: 'ENQ-000001',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      customerCompany: 'Apex Technologies Pvt Ltd',
      customerContactPerson: 'Karthik Ramanathan',
      customerMobile: '9840123456',
      customerEmail: 'karthik@apextech.in',
      source: 'Direct / Website',
      type: 'Security Surveillance',
      priority: 'High',
      assignedTo: 'Super Admin',
      status: 'QUOTATION_ISSUED',
      currentStage: 'Quotation Issued',
      workflowStage: 'QUOTATION_ISSUED',
      lastAction: 'Issued Quotation QT-000001',
      nextAction: 'Follow up on order confirmation',
      nextFollowUpDate: '2026-10-10',
      description: 'Requirement for Dahua 5MP IP Surveillance System for corporate headquarters.',
      productsInterested: 'Dahua 5MP IR Bullet Camera',
      expectedBudget: '₹25,000',
      attachments: [],
      createdAt: '2026-10-02T10:00:00.000Z',
      updatedAt: '2026-10-03T11:00:00.000Z',
      quotationId: 'QT-000001',
      followUps: [
        {
          id: 'FU-001-1',
          contactType: 'Phone Call',
          contactDate: '2026-10-02T11:30:00.000Z',
          employee: 'Super Admin',
          notes: 'Discussed site survey and camera placement requirements with client.',
          outcome: 'Customer requested official quotation.',
          nextAction: 'Generate and send formal quotation',
          nextFollowUpDate: '2026-10-04',
          createdAt: '2026-10-02T11:35:00.000Z'
        }
      ]
    }
  ],
  orders: [
    {
      orderId: 'ORD-000001',
      enquiryId: 'ENQ-000001',
      quotationId: 'QT-000001',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      company: 'Apex Technologies Pvt Ltd',
      amount: 25960,
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          quantity: 2,
          rate: 11000,
          gstRate: 18,
          taxAmount: 3960,
          total: 25960
        }
      ],
      lineItems: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          quantity: 2,
          rate: 11000,
          gstRate: 18,
          taxAmount: 3960,
          total: 25960
        }
      ],
      status: 'COMPLETED',
      stockDeducted: true,
      remarks: 'Order confirmed and approved against Quotation QT-000001.',
      createdAt: '2026-10-05T15:00:00.000Z',
      createdBy: 'Super Admin'
    }
  ],
  leads: [
    {
      leadId: 'LEAD-000001',
      enquiryId: 'ENQ-000001',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      title: 'Corporate Surveillance Upgrade',
      status: 'Converted',
      createdAt: '2026-10-01T09:30:00.000Z',
      updatedAt: '2026-10-05T15:00:00.000Z'
    }
  ],
  quotations: [
    {
      quotationId: 'QT-000001',
      enquiryId: 'ENQ-000001',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      amount: 25960,
      item: 'Dahua 5MP IR Bullet Camera',
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          description: '5MP HD IR Bullet IP Camera with Starlight Technology',
          hsnSac: '85258090',
          quantity: 2,
          unitPrice: 11000,
          rate: 11000,
          discount: 0,
          gst: 18,
          taxAmount: 3960,
          total: 25960
        }
      ],
      subtotal: 22000,
      gstTotal: 3960,
      grandTotal: 25960,
      validUntil: '2026-11-15',
      remarks: 'Standard 1-year manufacturer warranty with on-site deployment support.',
      status: 'Accepted',
      orderId: 'ORD-000001',
      stockDeducted: true,
      createdAt: '2026-10-03T11:00:00.000Z',
      updatedAt: '2026-10-05T15:00:00.000Z',
      createdBy: 'Super Admin'
    }
  ],
  deliveryChallans: [
    {
      challanId: 'DC-000001',
      orderId: 'ORD-000001',
      quotationId: 'QT-000001',
      enquiryId: 'ENQ-000001',
      refNo: 'DC-000001',
      poNumber: 'PO-00001',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      company: 'Apex Technologies Pvt Ltd',
      customerAddress: 'Apex Towers, No. 45, Anna Salai, Guindy, Chennai - 600032',
      deliveryDate: '2026-10-06',
      deliveryAddress: 'Apex Technology Center, MEPZ-SEZ, Tambaram, Chennai - 600045',
      dispatchDetails: 'Direct Dispatch via Road Express',
      transitMode: 'Road Express',
      vehicleDetails: 'TN-02-AB-9876',
      receiverName: 'Karthik Ramanathan',
      executiveEngineer: 'Super Admin',
      executiveEngineerId: 'USR-001',
      deliveryPurpose: 'NORMAL',
      status: 'DELIVERED',
      deliveryStatus: 'Delivered',
      documentType: 'Delivery Challan',
      documentTitle: 'Delivery Challan',
      isReturnableDC: false,
      requiredQty: 2,
      previouslyDeliveredQty: 0,
      currentDeliveryQty: 2,
      remainingAfterThisDC: 0,
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          requiredQty: 2,
          deliveryQty: 2,
          quantity: 2,
          unit: 'Nos',
          hsnSac: '85258090',
          unitPrice: 11000,
          gst: 18,
          serialized: true,
          serialNumbers: ['CAM-IPC-001-SN-1001', 'CAM-IPC-001-SN-1002']
        }
      ],
      stockDeducted: true,
      invoiceId: 'INV-000001',
      remarks: 'Delivered with full factory seals intact.',
      createdAt: '2026-10-06T10:00:00.000Z',
      deliveredAt: '2026-10-06T14:00:00.000Z',
      createdBy: 'Super Admin'
    }
  ],
  invoices: [
    {
      invoiceId: 'INV-000001',
      proformaId: 'PI-000001',
      proformaDate: '2026-10-04',
      orderId: 'ORD-000001',
      challanId: 'DC-000001',
      challanDate: '2026-10-06',
      enquiryId: 'ENQ-000001',
      quotationId: 'QT-000001',
      quotationDate: '2026-10-03',
      poNumber: 'PO-00001',
      poDate: '2026-09-16',
      dispatchThrough: 'Road Express (TN-02-AB-9876)',
      dispatchDate: '2026-10-06',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      company: 'Apex Technologies Pvt Ltd',
      consigneeName: 'Apex Technologies Pvt Ltd',
      consigneeAddress: 'Apex Towers, No. 45, Anna Salai, Guindy, Chennai - 600032',
      consigneeGstin: '33AAACA1234A1Z5',
      consigneeState: 'Tamil Nadu',
      shippingAddress: 'Apex Technology Center, MEPZ-SEZ, Tambaram, Chennai - 600045',
      shippingGstin: '33AAACA1234A1Z5',
      shippingState: 'Tamil Nadu',
      customerPhone: '9840123456',
      customerEmail: 'karthik@apextech.in',
      invoiceDate: '2026-10-06',
      dueDate: '2026-11-05',
      subtotal: 22000,
      gstTotal: 3960,
      discount: 0,
      grandTotal: 25960,
      status: 'PAID',
      stockDeducted: true,
      paymentStatus: 'PAID',
      paymentMode: 'Bank Transfer (NEFT/RTGS)',
      paymentDate: '2026-10-07',
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          hsnSac: '85258090',
          quantity: 2,
          unitPrice: 11000,
          rate: 11000,
          gstRate: 18,
          taxAmount: 3960,
          grandTotal: 25960,
          serialNumbers: ['CAM-IPC-001-SN-1001', 'CAM-IPC-001-SN-1002']
        }
      ],
      bankDetails: {
        bankName: 'HDFC BANK',
        accountName: 'ACTIVE SYSTEM INTEGRATION',
        accountNumber: '50200028741215',
        ifscCode: 'HDFC0000024',
        branch: 'ANNA NAGAR, CHENNAI'
      },
      companyDetails: {
        companyName: 'Active System Integration',
        siteShortName: 'ASI',
        gstin: '33AZPPS7068A1Z4',
        state: 'Tamil Nadu',
        city: 'Chennai'
      },
      remarks: 'Payment received in full via HDFC Bank on 07/10/2026.',
      createdAt: '2026-10-06T15:00:00.000Z',
      createdBy: 'Super Admin'
    }
  ],
  proformas: [
    {
      proformaId: 'PI-000001',
      revisionNumber: 1,
      revisionId: 'PI-000001-R1',
      isLatest: true,
      status: 'APPROVED',
      proformaDate: '2026-10-04',
      validUntil: '2026-10-19',
      createdAt: '2026-10-04T12:00:00.000Z',
      updatedAt: '2026-10-04T12:00:00.000Z',
      createdBy: 'Super Admin',
      customerId: 'CUST-000001',
      customerName: 'Apex Technologies Pvt Ltd',
      company: 'Apex Technologies Pvt Ltd',
      contactPerson: 'Karthik Ramanathan',
      customerPhone: '9840123456',
      customerEmail: 'karthik@apextech.in',
      consigneeName: 'Apex Technologies Pvt Ltd',
      consigneeAddress: 'Apex Towers, No. 45, Anna Salai, Guindy, Chennai - 600032',
      consigneeGstin: '33AAACA1234A1Z5',
      consigneeState: 'Tamil Nadu',
      shippingAddress: 'Apex Technology Center, MEPZ-SEZ, Tambaram, Chennai - 600045',
      shippingGstin: '33AAACA1234A1Z5',
      shippingState: 'Tamil Nadu',
      isInterstate: false,
      enquiryId: 'ENQ-000001',
      quotationId: 'QT-000001',
      quotationNumber: 'QT-000001',
      quotationDate: '2026-10-03',
      orderId: 'ORD-000001',
      paymentTerms: '100% Advance Against Proforma',
      deliveryTerms: 'Ex-Stock / Immediate Delivery',
      validityNotes: '15 Days from Proforma Date',
      proformaNote: 'Kindly verify item model/specifications before release of PO/payment.',
      remarks: 'Proforma approved for corporate purchase order release.',
      showDiscount: false,
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          description: '5MP HD IR Bullet IP Camera with Starlight Technology',
          hsnSac: '85258090',
          quantity: 2,
          rate: 11000,
          discount: 0,
          taxableAmount: 22000,
          gstRate: 18,
          cgst: 1980,
          sgst: 1980,
          igst: 0,
          taxAmount: 3960,
          grandTotal: 25960
        }
      ],
      subtotal: 22000,
      totalDiscount: 0,
      discountTotal: 0,
      taxableSubtotal: 22000,
      taxableAmount: 22000,
      cgst: 1980,
      sgst: 1980,
      igst: 0,
      gstTotal: 3960,
      taxTotal: 3960,
      calculatedTotal: 25960,
      roundOffEnabled: false,
      roundOff: 0,
      roundOffAmount: 0,
      grandTotal: 25960,
      stockDeducted: true,
      convertedInvoiceId: 'INV-000001',
      convertedInvoiceDate: '2026-10-06'
    }
  ],
  suppliers: [
    {
      id: 'SUP-000001',
      companyName: 'Dahua Technology India Pvt Ltd',
      contactPerson: 'Suresh Mehra',
      phone: '04428123456',
      email: 'orders.india@dahuatech.com',
      gstin: '33AAACD9876K1Z2',
      address: 'Block C, Olympia Tech Park, SIDCO Industrial Estate, Guindy',
      city: 'Chennai',
      state: 'Tamil Nadu',
      notes: 'Authorized Dahua National Distributor',
      createdAt: '2026-09-15T09:00:00.000Z'
    }
  ],
  purchaseOrders: [
    {
      id: 'PO-00001',
      purchaseOrderId: 'PO-00001',
      supplierId: 'SUP-000001',
      supplierSnapshot: {
        id: 'SUP-000001',
        companyName: 'Dahua Technology India Pvt Ltd',
        gstin: '33AAACD9876K1Z2',
        phone: '04428123456',
        email: 'orders.india@dahuatech.com',
        city: 'Chennai',
        state: 'Tamil Nadu'
      },
      orderDate: '2026-09-16',
      expectedDeliveryDate: '2026-09-25',
      status: 'RECEIVED',
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          hsnSac: '85258090',
          quantity: 10,
          unitRate: 4500,
          gstRate: 18,
          taxAmount: 8100,
          totalValue: 45000,
          receivedQty: 10
        }
      ],
      subtotal: 45000,
      cgst: 4050,
      sgst: 4050,
      igst: 0,
      roundOff: 0,
      grandTotal: 53100,
      paymentTerms: '30 Days Credit',
      deliveryAddress: 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
      termsAndConditions: 'Goods must be supplied with original manufacturer warranty and serialized packaging.',
      remarks: 'Initial replenishment of Dahua 5MP IP Cameras.',
      createdAt: '2026-09-16T11:00:00.000Z',
      updatedAt: '2026-09-25T14:30:00.000Z',
      createdBy: 'Super Admin'
    }
  ],
  goodsReceipts: [
    {
      id: 'GRN-00001',
      grnId: 'GRN-00001',
      purchaseOrderId: 'PO-00001',
      poNumber: 'PO-00001',
      supplierId: 'SUP-000001',
      supplierName: 'Dahua Technology India Pvt Ltd',
      receivedDate: '2026-09-25',
      receivedBy: 'Super Admin',
      items: [
        {
          productId: 'PROD-000001',
          productCode: 'CAM-IPC-001',
          productName: 'Dahua 5MP IR Bullet Camera',
          orderedQty: 10,
          receivedQty: 10,
          unitRate: 4500,
          serialNumbers: [
            'CAM-IPC-001-SN-1001',
            'CAM-IPC-001-SN-1002',
            'CAM-IPC-001-SN-1003',
            'CAM-IPC-001-SN-1004',
            'CAM-IPC-001-SN-1005',
            'CAM-IPC-001-SN-1006',
            'CAM-IPC-001-SN-1007',
            'CAM-IPC-001-SN-1008',
            'DH-CAM-EXP-06M',
            'DH-CAM-EXP-12M'
          ]
        }
      ],
      totalReceivedQty: 10,
      notes: 'Inward complete against PO-00001. All 10 serialized units verified and barcode scanned.',
      status: 'COMPLETED',
      createdAt: '2026-09-25T14:30:00.000Z',
      createdBy: 'Super Admin'
    }
  ]
};

// Write pruned crm-data.json
fs.writeFileSync(crmPath, JSON.stringify(goldenCrmData, null, 2), 'utf8');
console.log('✓ Successfully wrote golden sample records to crm-data.json');

// 2. Clean stocks-data.json: Preserve catalog products & setup clean inventory transactions
const stocksData = JSON.parse(fs.readFileSync(stocksPath, 'utf8'));

// Retain all master categories, subcategories, brands
// Update CAM-IPC-001 product stock & serialNumbers
const dahuaProd = stocksData.products.find((p) => p.code === 'CAM-IPC-001' || p.id === 'PROD-000001');
if (dahuaProd) {
  // 10 inward, 2 dispatched in DC-000001 -> 8 remaining
  dahuaProd.stock = 8;
  dahuaProd.serialNumbers = [
    'DH-CAM-EXP-06M',
    'DH-CAM-EXP-12M',
    'CAM-IPC-001-SN-1003',
    'CAM-IPC-001-SN-1004',
    'CAM-IPC-001-SN-1005',
    'CAM-IPC-001-SN-1006',
    'CAM-IPC-001-SN-1007',
    'CAM-IPC-001-SN-1008'
  ];
  dahuaProd.serialMetadata = {
    'DH-CAM-EXP-06M': {
      inwardDate: '2025-04-16',
      expiryDate: '2027-04-16',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'DH-CAM-EXP-12M': {
      inwardDate: '2025-10-16',
      expiryDate: '2027-10-16',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'CAM-IPC-001-SN-1003': {
      inwardDate: '2026-09-25',
      expiryDate: '2028-09-25',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'CAM-IPC-001-SN-1004': {
      inwardDate: '2026-09-25',
      expiryDate: '2028-09-25',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'CAM-IPC-001-SN-1005': {
      inwardDate: '2026-09-25',
      expiryDate: '2028-09-25',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'CAM-IPC-001-SN-1006': {
      inwardDate: '2026-09-25',
      expiryDate: '2028-09-25',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'CAM-IPC-001-SN-1007': {
      inwardDate: '2026-09-25',
      expiryDate: '2028-09-25',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    },
    'CAM-IPC-001-SN-1008': {
      inwardDate: '2026-09-25',
      expiryDate: '2028-09-25',
      shelfLifeMonths: 24,
      grnReference: 'GRN-00001',
      supplierName: 'Dahua Technology India Pvt Ltd'
    }
  };
}

// Clean inventory transactions: 1 Inward (GRN-00001) + 1 Outward Dispatch (DC-000001)
stocksData.inventoryTransactions = [
  {
    id: 'TXN-GRN-GRN-00001-CAM-IPC-001',
    productId: 'PROD-000001',
    productCode: 'CAM-IPC-001',
    productName: 'Dahua 5MP IR Bullet Camera',
    date: '2026-09-25T14:30:00.000Z',
    event: 'Goods Receipt',
    reference: 'GRN-00001',
    referenceType: 'GRN',
    referenceId: 'GRN-00001',
    poReference: 'PO-00001',
    quantity: 10,
    unitRate: 4500,
    gstRate: 18,
    taxAmount: 8100,
    totalValue: 45000,
    supplierId: 'SUP-000001',
    supplierName: 'Dahua Technology India Pvt Ltd',
    partyName: 'Dahua Technology India Pvt Ltd',
    customerName: null,
    serialNumbers: [
      'CAM-IPC-001-SN-1001',
      'CAM-IPC-001-SN-1002',
      'CAM-IPC-001-SN-1003',
      'CAM-IPC-001-SN-1004',
      'CAM-IPC-001-SN-1005',
      'CAM-IPC-001-SN-1006',
      'CAM-IPC-001-SN-1007',
      'CAM-IPC-001-SN-1008',
      'DH-CAM-EXP-06M',
      'DH-CAM-EXP-12M'
    ],
    remarks: 'Received 10 units under PO-00001 / GRN-00001',
    currentStock: 10,
    type: 'STOCK IN',
    stockBefore: 0,
    stockAfter: 10,
    createdAt: '2026-09-25T14:30:00.000Z',
    createdBy: 'Super Admin'
  },
  {
    id: 'TXN-DC-DC-000001-CAM-IPC-001',
    productId: 'PROD-000001',
    productCode: 'CAM-IPC-001',
    productName: 'Dahua 5MP IR Bullet Camera',
    date: '2026-10-06T10:00:00.000Z',
    event: 'Delivery Challan',
    reference: 'DC-000001',
    referenceType: 'DC',
    referenceId: 'DC-000001',
    quantity: -2,
    unitRate: 11000,
    gstRate: 18,
    taxAmount: 3960,
    totalValue: 22000,
    customerId: 'CUST-000001',
    customerName: 'Apex Technologies Pvt Ltd',
    partyName: 'Apex Technologies Pvt Ltd',
    serialNumbers: ['CAM-IPC-001-SN-1001', 'CAM-IPC-001-SN-1002'],
    remarks: 'Dispatched to Apex Technologies Pvt Ltd under DC-000001',
    currentStock: 8,
    type: 'STOCK OUT',
    stockBefore: 10,
    stockAfter: 8,
    supplierName: null,
    createdAt: '2026-10-06T10:00:00.000Z',
    createdBy: 'Super Admin'
  }
];

fs.writeFileSync(stocksPath, JSON.stringify(stocksData, null, 2), 'utf8');
console.log('✓ Successfully synchronized stocks-data.json with clean inventory movement');

console.log('--- DATA CLEANUP SCRIPT COMPLETED SUCCESSFULLY ---');
