const path = require("path");
const fs = require("fs");

// Ensure environment variables are reliably loaded from backend/.env or root .env
const backendEnv = path.resolve(__dirname, ".env");
const rootEnv = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(backendEnv)) {
  require("dotenv").config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  require("dotenv").config({ path: rootEnv });
} else {
  require("dotenv").config();
}

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const stockRoutes = require("./routes/stockRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const goodsReceiptRoutes = require("./routes/goodsReceiptRoutes");
const { getSmsConfigSummary } = require("./utils/smsProvider");
const connectDB = require("./config/db");

const app = express();

// Initialize MongoDB Atlas connection
connectDB();

const allowedOrigins = [
  'https://crm.asiind.com',
  'https://asiind.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.asiind.com')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.get("/", (req, res) => {
    res.send("ASICRM Backend Running at https://crmapi.asiind.com");
});

app.get("/api/test", (req, res) => {
    res.json({
        message: "Frontend connected to backend successfully",
        apiUrl: process.env.PUBLIC_API_URL || "https://crmapi.asiind.com"
    });
});

// Mounted API Routes
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/goods-receipts", goodsReceiptRoutes);

const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || '0.0.0.0';

const server = app.listen(port, host, () => {
    const publicApi = process.env.PUBLIC_API_URL || 'https://crmapi.asiind.com';
    console.log(`Server running on port ${port} (Public API: ${publicApi})`);
    const sms = getSmsConfigSummary();
    console.log(`[CONFIG] SMS_PROVIDER configured: ${sms.SMS_PROVIDER_configured}`);
    console.log(`[CONFIG] SMS_API_KEY configured: ${sms.SMS_API_KEY_configured}`);
    console.log(`[CONFIG] SMS_SENDER configured: ${sms.SMS_SENDER_configured} (${sms.SMS_SENDER})`);
    console.log(`[CONFIG] SMS_PROVIDER_ENABLED: ${sms.SMS_PROVIDER_ENABLED}`);
    console.log(`[CONFIG] NODE_ENV: ${sms.NODE_ENV}`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the existing ASICRM backend process before starting this one.`);
        process.exitCode = 1;
        return;
    }
    console.error('Backend failed to start:', error);
});

