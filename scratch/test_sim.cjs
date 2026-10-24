const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9713;
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_sim_user_'));
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
  // Match user's exact screen in media_1791612648448.png
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 920, deviceScaleFactor: 1, mobile: false });
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

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const chk = await send('Runtime.evaluate', { expression: `Boolean(document.querySelector('.table-data-row'))`, returnByValue: true });
    if (chk.result && chk.result.value) break;
  }
  await new Promise(r => setTimeout(r, 600));

  // Apply height 100% on table & tbody
  await send('Runtime.evaluate', {
    expression: `(() => {
      const style = document.createElement('style');
      style.textContent = \`
        .enquiry-register-table {
          height: 100% !important;
          display: table !important;
        }
        .enquiry-register-table tbody {
          height: 100% !important;
        }
        .enquiry-register-table tbody tr {
          height: auto !important;
        }
        .enquiry-register-table tbody td {
          height: auto !important;
          vertical-align: middle !important;
        }
      \`;
      document.head.appendChild(style);
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const table = document.querySelector('.enquiry-register-table');
      const footer = document.querySelector('.crm-table-footer, .stocks-table-footer');
      const rows = table.querySelectorAll('tbody tr');
      const lastRow = rows[rows.length - 1];
      return {
        rowsCount: rows.length,
        firstRowHeight: rows[0].getBoundingClientRect().height,
        lastRowBottom: lastRow.getBoundingClientRect().bottom,
        footerTop: footer.getBoundingClientRect().top,
        gap: footer.getBoundingClientRect().top - lastRow.getBoundingClientRect().bottom
      };
    })()`,
    returnByValue: true
  });
  console.log('SIMULATED USER VIEW:', JSON.stringify(check.result.value, null, 2));

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test_simulated_user_view.png'), Buffer.from(ss.data, 'base64'));
  console.log('Saved test_simulated_user_view.png');

  ws.close();
  chrome.kill();
}
run().catch(console.error);
