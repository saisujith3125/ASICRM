const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  Customer,
  Enquiry,
  Lead,
  Quotation,
  Order,
  DeliveryChallan,
  Invoice,
  Proforma,
  PurchaseOrder,
  GoodsReceipt,
  Supplier,
  Product,
  InventoryTransaction,
  CompanySetting
} = require('../models');

// Load environment variables
const backendEnv = path.resolve(__dirname, '..', '.env');
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(backendEnv)) {
  require('dotenv').config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config();
}

const CRM_DATA_FILE = path.resolve(__dirname, '..', 'data', 'crm-data.json');
const STOCKS_DATA_FILE = path.resolve(__dirname, '..', 'data', 'stocks-data.json');
const ACCESS_DATA_FILE = path.resolve(__dirname, '..', 'data', 'access-control.json');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[MIGRATION ERROR] MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to MongoDB Atlas:', mongoose.connection.name);

  // 1. Read CRM Data
  const crm = JSON.parse(fs.readFileSync(CRM_DATA_FILE, 'utf8'));
  const stocks = JSON.parse(fs.readFileSync(STOCKS_DATA_FILE, 'utf8'));
  const access = JSON.parse(fs.readFileSync(ACCESS_DATA_FILE, 'utf8'));

  console.log('\n--- SEEDING CLEAN CRM DATA INTO MONGODB ---');

  if (crm.customers?.length) {
    await Customer.deleteMany({});
    await Customer.insertMany(crm.customers);
    console.log(`✓ Customers migrated: ${crm.customers.length}`);
  }

  if (crm.enquiries?.length) {
    await Enquiry.deleteMany({});
    await Enquiry.insertMany(crm.enquiries);
    console.log(`✓ Enquiries migrated: ${crm.enquiries.length}`);
  }

  if (crm.leads?.length) {
    await Lead.deleteMany({});
    await Lead.insertMany(crm.leads);
    console.log(`✓ Leads migrated: ${crm.leads.length}`);
  }

  if (crm.quotations?.length) {
    await Quotation.deleteMany({});
    await Quotation.insertMany(crm.quotations);
    console.log(`✓ Quotations migrated: ${crm.quotations.length}`);
  }

  if (crm.orders?.length) {
    await Order.deleteMany({});
    await Order.insertMany(crm.orders);
    console.log(`✓ Orders migrated: ${crm.orders.length}`);
  }

  if (crm.deliveryChallans?.length) {
    await DeliveryChallan.deleteMany({});
    await DeliveryChallan.insertMany(crm.deliveryChallans);
    console.log(`✓ Delivery Challans migrated: ${crm.deliveryChallans.length}`);
  }

  if (crm.invoices?.length) {
    await Invoice.deleteMany({});
    await Invoice.insertMany(crm.invoices);
    console.log(`✓ Invoices migrated: ${crm.invoices.length}`);
  }

  if (crm.proformas?.length) {
    await Proforma.deleteMany({});
    await Proforma.insertMany(crm.proformas);
    console.log(`✓ Proformas migrated: ${crm.proformas.length}`);
  }

  if (crm.purchaseOrders?.length) {
    await PurchaseOrder.deleteMany({});
    await PurchaseOrder.insertMany(crm.purchaseOrders);
    console.log(`✓ Purchase Orders migrated: ${crm.purchaseOrders.length}`);
  }

  if (crm.goodsReceipts?.length) {
    await GoodsReceipt.deleteMany({});
    await GoodsReceipt.insertMany(crm.goodsReceipts);
    console.log(`✓ Goods Receipts migrated: ${crm.goodsReceipts.length}`);
  }

  if (crm.suppliers?.length) {
    await Supplier.deleteMany({});
    await Supplier.insertMany(crm.suppliers);
    console.log(`✓ Suppliers migrated: ${crm.suppliers.length}`);
  }

  console.log('\n--- SEEDING STOCKS & INVENTORY INTO MONGODB ---');

  if (stocks.products?.length) {
    await Product.deleteMany({});
    await Product.insertMany(stocks.products);
    console.log(`✓ Products migrated: ${stocks.products.length}`);
  }

  if (stocks.inventoryTransactions?.length) {
    await InventoryTransaction.deleteMany({});
    await InventoryTransaction.insertMany(stocks.inventoryTransactions);
    console.log(`✓ Inventory Transactions migrated: ${stocks.inventoryTransactions.length}`);
  }

  console.log('\n--- SEEDING COMPANY PROFILE & SETTINGS INTO MONGODB ---');
  if (access.companySettings) {
    await CompanySetting.deleteMany({});
    await CompanySetting.create({
      id: 'COMPANY_SETTINGS_SINGLETON',
      ...access.companySettings
    });
    console.log(`✓ Company Settings migrated: ${access.companySettings.companyName}`);
  }

  console.log('\n=========================================');
  console.log(' MONGODB ATLAS SEEDING COMPLETED CLEANLY!');
  console.log('=========================================');

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('[MIGRATION FAILED]', err.message);
  process.exit(1);
});
