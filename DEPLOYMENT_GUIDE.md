# ASICRM Enterprise - Complete Deployment & Operations Guide

This guide is designed for any system administrator, DevOps engineer, or developer deploying the ASICRM platform to production (e.g., `https://crmapi.asiind.com`).

---

## ⚡ Option 1: One-Click Automated Deployment (Recommended)

An automated deployment script is built directly into the project root. On your production Linux/Ubuntu server, simply run:

```bash
cd /path/to/ASICRM
bash deploy.sh
```

### What `deploy.sh` does automatically:
1. Pulls the latest commits from `origin/main` on GitHub.
2. Checks and installs any updated dependencies in `backend/` and `frontend/`.
3. Compiles the React production bundle (`cd frontend && npm run build`), creating `frontend/dist/`.
4. Restarts the running Node.js process under **PM2** (or systemd) with zero downtime.
5. Performs a live HTTP health check against `http://localhost:5000/api/health`.

---

## 🛠️ Option 2: Step-by-Step Manual Deployment

If you prefer executing the deployment steps manually on the server terminal:

### Step 1: Update Repository
```bash
cd /path/to/ASICRM
git fetch origin main
git pull origin main
```

### Step 2: Build the Frontend Production Assets
```bash
cd frontend
npm install
npm run build
cd ..
```
*Verify that `frontend/dist/index.html` exists.*

### Step 3: Install Backend Dependencies (if updated)
```bash
cd backend
npm install --omit=dev
cd ..
```

### Step 4: Restart the Backend Service
Depending on your server runner:

- **Using PM2:**
  ```bash
  pm2 restart all
  # Or restart specific app:
  pm2 restart asicrm
  ```
- **Using systemd:**
  ```bash
  sudo systemctl restart asicrm
  ```
- **Using standalone Node:**
  ```bash
  cd backend
  node server.js
  ```

---

## 🔐 Environment Configuration (`backend/.env`)

Ensure the `backend/.env` file on the production server contains the following production keys:

```ini
# Environment & Server
NODE_ENV=production
PORT=5000
PUBLIC_API_URL=https://crmapi.asiind.com

# MongoDB Cloud Atlas Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/asicrm?retryWrites=true&w=majority

# OTP Timing & Security
OTP_EXPIRY_MS=600000
RESEND_COOLDOWN_MS=90000
MAX_REQUESTS_PER_WINDOW=5

# Pay4SMS Live SMS Gateway Integration
SMS_PROVIDER_ENABLED=true
PAY4SMS_BASE_URL=http://pay4sms.in/sendsms/
PAY4SMS_TOKEN=your_pay4sms_token_here
PAY4SMS_CREDIT=2
PAY4SMS_SENDER=ASISYS
PAY4SMS_TEMPLATE_ID=1707178360741677122
SMS_MESSAGE_TEMPLATE=Dear User, your login OTP for Active System Integration is ${otp}. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com
```

---

## 🧪 Post-Deployment Verification Checklist

After deploying, verify the live application at `https://crmapi.asiind.com`:

| Step | Test Action | Expected Result |
| :--- | :--- | :--- |
| **1** | Open `https://crmapi.asiind.com` in Chrome (**Ctrl + F5**) | Mobile input is **completely blank**. No pre-filled numbers. No "Default: Super Admin" button. |
| **2** | Enter an unregistered mobile number (e.g. `9999999990`) | Displays error: *"No active ASICRM user is registered for this mobile number."* |
| **3** | Enter a registered mobile number (e.g. `9994126686` for Super Admin) | Clicks *Send OTP*. Screen advances to Step 2. |
| **4** | Inspect the OTP screen | All 4 digit boxes are **blank**. No "Default check account" banner. No "Default OTP: 1234" badge. |
| **5** | SMS Delivery | User receives an authentic 4-digit code on their mobile via Pay4SMS. |
| **6** | Entering `1234` | Rejects with *"Invalid OTP. 2 attempts remaining."* |
| **7** | Entering real SMS code | Successfully logs in and loads CRM Dashboard. |
| **8** | Open `/quotations/new` | Quotation toolbar has **no** blue `+ Add Product` button. Bottom has `+ Add Row`. Empty rows show `+ Add Product`, filled rows show `Edit Product`. |
| **9** | Open `/stocks/products/new` | Product code is auto-allocated as `ASI-48` (or next free number). All fields are unlocked. Form starts completely blank. |
| **10** | Open `/stocks/products/edit` | All descriptive & catalog fields (Name, HSN, Description, Category, Brand, Unit, Details, Link) are **fully unlocked and editable**. Only the immutable code remains locked. |
| **11** | Open `/settings/database-backup` | Clear Active Database modal includes **Stocks and Products Master** checkbox with warning. |
| **12** | Open `/settings/serial-numbers` & `/settings/date-format` | On large/wide screens (1400px+), all tables expand smoothly with zero text wrapping or chopped IDs. |

---

## 🔍 Troubleshooting & Common Issues

### 1. Browser still shows old design after deploy
The browser may have cached the previous JavaScript bundle.  
**Fix**: Perform a hard refresh:
- Windows/Linux: **`Ctrl + F5`** or **`Shift + F5`**
- Mac: **`Cmd + Shift + R`**

### 2. View Backend Logs
```bash
pm2 logs asicrm --lines 100
```
or check `logs/` in the project root.

### 3. Check Live API Health
```bash
curl -i https://crmapi.asiind.com/api/health
```
Expected response:
```json
{"status":"healthy","uptime":...,"timestamp":"..."}
```
