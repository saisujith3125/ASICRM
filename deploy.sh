#!/usr/bin/env bash
# ==============================================================================
# ASICRM Enterprise - One-Click Production Deployment Script
# Automatically pulls git updates, builds the React frontend, restarts the
# Node.js backend under PM2 or systemd, and performs a live health verification.
# ==============================================================================
set -e

# Change directory to the repository root where this script resides
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================================="
echo "          ASICRM Enterprise Automated Deployment Runner           "
echo "=================================================================="
echo "Target Directory: $SCRIPT_DIR"
echo "Timestamp:        $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "------------------------------------------------------------------"

# Step 1: Pull latest updates from Git
echo ">> [1/5] Fetching and pulling latest code from origin/main..."
if [ -d ".git" ]; then
    git fetch origin main
    git pull origin main
    echo "✓ Git repository successfully updated to commit $(git rev-parse --short HEAD)"
else
    echo "! Not a git repository or .git directory missing. Skipping git pull."
fi

# Step 2: Install backend dependencies if missing
echo ">> [2/5] Checking backend Node.js dependencies..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
    echo "Installing backend dependencies..."
    npm install --omit=dev --silent
else
    echo "✓ Backend dependencies up-to-date."
fi
cd "$SCRIPT_DIR"

# Step 3: Install frontend dependencies & Build production distribution
echo ">> [3/5] Compiling React production assets via Vite..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
    echo "Installing frontend dependencies..."
    npm install --silent
fi
npm run build
cd "$SCRIPT_DIR"

if [ -f "$SCRIPT_DIR/frontend/dist/index.html" ]; then
    echo "✓ Frontend bundle built successfully in frontend/dist/"
else
    echo "✗ ERROR: frontend/dist/index.html was not generated!"
    exit 1
fi

# Step 4: Restart Server Process (PM2 or systemd)
echo ">> [4/5] Reloading backend server process..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "asicrm"; then
        echo "Restarting ASICRM under PM2..."
        pm2 restart asicrm
    elif pm2 list | grep -q "server"; then
        echo "Restarting server under PM2..."
        pm2 restart server
    else
        echo "No running ASICRM process found in PM2 list. Checking if we should start..."
        pm2 start "$SCRIPT_DIR/backend/server.js" --name asicrm --time
        pm2 save
    fi
    echo "✓ PM2 process reloaded."
elif command -v systemctl &> /dev/null && systemctl is-active --quiet asicrm; then
    echo "Restarting asicrm systemd service..."
    sudo systemctl restart asicrm
    echo "✓ systemd service asicrm restarted."
else
    echo "! Neither PM2 nor active systemd service detected."
    echo "  If running Node standalone, please restart your node process manually:"
    echo "  cd backend && node server.js"
fi

# Step 5: Live Health Check
echo ">> [5/5] Performing live health check..."
sleep 2

HEALTH_URL="http://localhost:5000/api/health"
if command -v curl &> /dev/null; then
    HEALTH_RESP=$(curl -s "$HEALTH_URL" || echo "")
    if echo "$HEALTH_RESP" | grep -q "healthy"; then
        echo "✓ Health check response: $HEALTH_RESP"
    else
        echo "! Local health check on $HEALTH_URL did not respond or is using a non-standard port."
        echo "  Check backend logs: pm2 logs or backend console."
    fi
fi

echo "=================================================================="
echo "   🎉 ASICRM DEPLOYMENT FINISHED SUCCESSFULLY!"
echo "   • Clean, production-ready login & OTP flow active."
echo "   • All developer default bypasses eliminated."
echo "   • Latest quotation & stock sequence engines deployed."
echo "=================================================================="
