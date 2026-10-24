const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9700;
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_enq_ss_'));
const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1200));
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    const handler = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === msgId) { ws.removeEventListener('message', handler); resolve(d.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  // Laptop standard viewport: 1366x768 (standard laptop screen)
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
  await new Promise(r => setTimeout(r, 800));
  await send('Runtime.evaluate', {
    expression: `(() => {
      const user = { id: 'USR-001', name: 'Super Admin', role: 'SUPER_ADMIN', status: 'Active', permissions: { Enquiries: ['View', 'Create', 'Edit', 'Delete'], Stocks: ['View', 'Create', 'Edit', 'Delete'] } };
      localStorage.setItem('asicrm_user', JSON.stringify(user));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('token', 'mock-token');
    })()`
  });
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/enquiries' });
  await new Promise(r => setTimeout(r, 1800));
  
  // 1. Capture Page 1 screenshot (10 rows, zero scroll)
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'enquiries_page_1.png'), Buffer.from(ss1.data, 'base64'));
  console.log('Saved enquiries_page_1.png');

  // 2. Click the last page button in pagination to test fewer elements
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('.crm-pagination-btn'));
      // Find the highest number button before Next
      const numBtns = btns.filter(b => !isNaN(parseInt(b.textContent.trim())));
      if (numBtns.length > 0) {
        numBtns[numBtns.length - 1].click();
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));
  
  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'enquiries_last_page_few_elements.png'), Buffer.from(ss2.data, 'base64'));
  console.log('Saved enquiries_last_page_few_elements.png');

  ws.close();
  chrome.kill();
}
run();
