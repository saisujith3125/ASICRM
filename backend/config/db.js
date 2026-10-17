const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[DB] No MONGODB_URI found in environment variables. Falling back to local JSON store.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[DB] MongoDB Atlas Connected: ${conn.connection.host} / ${conn.connection.name}`);

    // Auto-sync store and stocks to MongoDB collections upon connection
    try {
      const { syncStoreToMongo, syncStockToMongo, syncSettingsToMongo } = require('../services/mongoSyncService');
      const crmPath = path.join(__dirname, '..', 'data', 'crm-data.json');
      const stocksPath = path.join(__dirname, '..', 'data', 'stocks-data.json');
      const accessPath = path.join(__dirname, '..', 'data', 'access-control.json');

      if (fs.existsSync(crmPath)) {
        const crmData = JSON.parse(fs.readFileSync(crmPath, 'utf8'));
        await syncStoreToMongo(crmData);
      }
      if (fs.existsSync(stocksPath)) {
        const stocksData = JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
        await syncStockToMongo(stocksData.products, stocksData.inventoryTransactions);
      }
      if (fs.existsSync(accessPath)) {
        const accessData = JSON.parse(fs.readFileSync(accessPath, 'utf8'));
        await syncSettingsToMongo(accessData.companySettings);
      }
      console.log('[DB] All collections synchronized to MongoDB Atlas successfully.');
    } catch (syncErr) {
      console.error('[DB] Initial auto-sync notice:', syncErr.message);
    }

    return conn;
  } catch (error) {
    console.error(`[DB] MongoDB Connection Notice: ${error.message}`);
    console.log('[DB] Operating in resilient offline/local cache mode.');
    return null;
  }
};

module.exports = connectDB;
