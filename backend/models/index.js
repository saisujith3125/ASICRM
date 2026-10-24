const mongoose = require('mongoose');

const schemaOptions = {
  strict: false,
  timestamps: true
};

const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  company: { type: String, index: true },
  mobile: { type: String, index: true },
  email: { type: String },
  status: { type: String, default: 'Active', index: true }
}, schemaOptions);

const enquirySchema = new mongoose.Schema({
  enquiryId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  quotationId: { type: String, index: true },
  status: { type: String, index: true },
  priority: { type: String, index: true }
}, schemaOptions);

const leadSchema = new mongoose.Schema({
  leadId: { type: String, required: true, unique: true, index: true },
  enquiryId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  status: { type: String, index: true }
}, schemaOptions);

const quotationSchema = new mongoose.Schema({
  quotationId: { type: String, required: true, unique: true, index: true },
  proposalNumber: { type: String, index: true },
  enquiryId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  status: { type: String, index: true },
  grandTotal: { type: Number }
}, schemaOptions);

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  quotationId: { type: String, index: true },
  enquiryId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  status: { type: String, index: true }
}, schemaOptions);

const deliveryChallanSchema = new mongoose.Schema({
  challanId: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  quotationId: { type: String, index: true },
  invoiceId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  status: { type: String, index: true }
}, schemaOptions);

const invoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  challanId: { type: String, index: true },
  quotationId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  status: { type: String, index: true },
  grandTotal: { type: Number }
}, schemaOptions);

const proformaSchema = new mongoose.Schema({
  proformaId: { type: String, required: true, unique: true, index: true },
  quotationId: { type: String, index: true },
  enquiryId: { type: String, index: true },
  customerId: { type: String, index: true },
  customerName: { type: String, index: true },
  status: { type: String, index: true }
}, schemaOptions);

const purchaseOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  poNumber: { type: String, index: true },
  supplierId: { type: String, index: true },
  status: { type: String, index: true },
  grandTotal: { type: Number }
}, schemaOptions);

const goodsReceiptSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  grnId: { type: String, index: true },
  purchaseOrderId: { type: String, index: true },
  supplierId: { type: String, index: true },
  status: { type: String, index: true }
}, schemaOptions);

const supplierSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  companyName: { type: String, required: true, index: true },
  gstin: { type: String, index: true },
  phone: { type: String },
  email: { type: String }
}, schemaOptions);

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  categoryId: { type: String, index: true },
  stock: { type: Number, default: 0 },
  serialized: { type: Boolean, default: false }
}, schemaOptions);

const inventoryTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  productId: { type: String, index: true },
  productCode: { type: String, index: true },
  reference: { type: String, index: true },
  referenceType: { type: String, index: true },
  type: { type: String, index: true }
}, schemaOptions);

const companySettingSchema = new mongoose.Schema({
  id: { type: String, required: true, default: 'COMPANY_SETTINGS_SINGLETON', unique: true, index: true }
}, schemaOptions);

module.exports = {
  Customer: mongoose.models.Customer || mongoose.model('Customer', customerSchema),
  Enquiry: mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema),
  Lead: mongoose.models.Lead || mongoose.model('Lead', leadSchema),
  Quotation: mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema),
  Order: mongoose.models.Order || mongoose.model('Order', orderSchema),
  DeliveryChallan: mongoose.models.DeliveryChallan || mongoose.model('DeliveryChallan', deliveryChallanSchema),
  Invoice: mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema),
  Proforma: mongoose.models.Proforma || mongoose.model('Proforma', proformaSchema),
  PurchaseOrder: mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', purchaseOrderSchema),
  GoodsReceipt: mongoose.models.GoodsReceipt || mongoose.model('GoodsReceipt', goodsReceiptSchema),
  Supplier: mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema),
  Product: mongoose.models.Product || mongoose.model('Product', productSchema),
  InventoryTransaction: mongoose.models.InventoryTransaction || mongoose.model('InventoryTransaction', inventoryTransactionSchema),
  CompanySetting: mongoose.models.CompanySetting || mongoose.model('CompanySetting', companySettingSchema)
};
