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

let isSyncing = false;

async function syncCollection(Model, items, keyField = 'id') {
  if (!items || !items.length) return;
  if (mongoose.connection.readyState !== 1) return;

  const ops = items.map((doc) => {
    const filter = { [keyField]: doc[keyField] };
    return {
      updateOne: {
        filter,
        update: { $set: doc },
        upsert: true
      }
    };
  });

  try {
    await Model.bulkWrite(ops, { ordered: false });
  } catch (err) {
    console.error(`[MONGO SYNC ERROR] ${Model.modelName}:`, err.message);
  }
}

async function syncStoreToMongo(store) {
  if (isSyncing || mongoose.connection.readyState !== 1) return;
  isSyncing = true;

  try {
    if (store.customers) await syncCollection(Customer, store.customers, 'id');
    if (store.enquiries) await syncCollection(Enquiry, store.enquiries, 'enquiryId');
    if (store.leads) await syncCollection(Lead, store.leads, 'leadId');
    if (store.quotations) await syncCollection(Quotation, store.quotations, 'quotationId');
    if (store.orders) await syncCollection(Order, store.orders, 'orderId');
    if (store.deliveryChallans) await syncCollection(DeliveryChallan, store.deliveryChallans, 'challanId');
    if (store.invoices) await syncCollection(Invoice, store.invoices, 'invoiceId');
    if (store.proformas) await syncCollection(Proforma, store.proformas, 'proformaId');
    if (store.purchaseOrders) await syncCollection(PurchaseOrder, store.purchaseOrders, 'id');
    if (store.goodsReceipts) await syncCollection(GoodsReceipt, store.goodsReceipts, 'id');
    if (store.suppliers) await syncCollection(Supplier, store.suppliers, 'id');
  } catch (error) {
    console.error('[MONGO SYNC BATCH ERROR]:', error.message);
  } finally {
    isSyncing = false;
  }
}

async function syncStockToMongo(products, inventoryTransactions) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    if (products) await syncCollection(Product, products, 'id');
    if (inventoryTransactions) await syncCollection(InventoryTransaction, inventoryTransactions, 'id');
  } catch (error) {
    console.error('[MONGO STOCK SYNC ERROR]:', error.message);
  }
}

async function syncSettingsToMongo(companySettings) {
  if (mongoose.connection.readyState !== 1 || !companySettings) return;
  try {
    await CompanySetting.updateOne(
      { id: 'COMPANY_SETTINGS_SINGLETON' },
      { $set: { id: 'COMPANY_SETTINGS_SINGLETON', ...companySettings } },
      { upsert: true }
    );
  } catch (error) {
    console.error('[MONGO SETTINGS SYNC ERROR]:', error.message);
  }
}

async function deleteFromMongo(Model, keyField, keyValue) {
  if (mongoose.connection.readyState !== 1 || !Model) return;
  try {
    await Model.deleteOne({ [keyField]: keyValue });
  } catch (err) {
    console.error(`[MONGO DELETE ERROR] ${Model?.modelName}:`, err.message);
  }
}

module.exports = {
  syncStoreToMongo,
  syncStockToMongo,
  syncSettingsToMongo,
  deleteFromMongo
};
