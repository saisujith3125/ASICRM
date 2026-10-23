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

// Trust reverse proxy (Nginx, Cloudflare, HAProxy) for correct protocol, host, and client IP
app.set("trust proxy", 1);

// Initialize MongoDB Atlas connection
connectDB();

const allowedOrigins = [
  "https://crmapi.asiind.com",
  "https://crm.asiind.com",
  "https://asiind.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".asiind.com") ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-user-id",
    "X-Requested-With",
    "Accept",
    "Origin"
  ]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security & identifying headers
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "ASICRM Backend");
  next();
});

// API Status & Health Check endpoints
app.get("/api", (req, res) => {
  res.json({
    status: "online",
    service: "ASICRM API",
    domain: "https://crmapi.asiind.com",
    publicApiUrl: process.env.PUBLIC_API_URL || "https://crmapi.asiind.com",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
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

// Catch unhandled API requests with clean JSON (preventing HTML 404 pages)
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Full-stack unified SPA serving:
// When frontend/dist exists, serve static assets and route non-API GET requests to index.html
const frontendDistPath = path.resolve(__dirname, "..", "frontend", "dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({
      status: "online",
      message: "ASICRM Backend Running at https://crmapi.asiind.com",
      publicApiUrl: process.env.PUBLIC_API_URL || "https://crmapi.asiind.com",
      timestamp: new Date().toISOString()
    });
  });
}

// Global JSON error handler
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
  });
});

const port = Number(process.env.PORT) || 5000;
const host = process.env.HOST || "0.0.0.0";

const server = app.listen(port, host, () => {
  const publicApi = process.env.PUBLIC_API_URL || "https://crmapi.asiind.com";
  console.log(`Server running on port ${port} (Public API: ${publicApi})`);
  const sms = getSmsConfigSummary();
  console.log(`[CONFIG] SMS_PROVIDER configured: ${sms.SMS_PROVIDER_configured}`);
  console.log(`[CONFIG] SMS_API_KEY configured: ${sms.SMS_API_KEY_configured}`);
  console.log(`[CONFIG] SMS_SENDER configured: ${sms.SMS_SENDER_configured} (${sms.SMS_SENDER})`);
  console.log(`[CONFIG] SMS_PROVIDER_ENABLED: ${sms.SMS_PROVIDER_ENABLED}`);
  console.log(`[CONFIG] NODE_ENV: ${sms.NODE_ENV}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the existing ASICRM backend process before starting this one.`);
    process.exitCode = 1;
    return;
  }
  console.error("Backend failed to start:", error);
});
