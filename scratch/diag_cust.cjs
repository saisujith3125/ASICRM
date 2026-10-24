const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9716;
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_dom_cust_'));

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 920, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
  await new Promise(r => setTimeout(r, 800));
  await send('Runtime.evaluate', {
    expression: `(() => {
      const user = { id: 'USR-001', name: 'Super Admin', role: 'SUPER_ADMIN', status: 'Active', permissions: { Customers: ['View', 'Create', 'Edit', 'Delete'], Enquiries: ['View', 'Create', 'Edit', 'Delete'] } };
      localStorage.setItem('asicrm_user', JSON.stringify(user));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('token', 'mock-token');
    })()`
  });
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/customers' });

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const chk = await send('Runtime.evaluate', { expression: `Boolean(document.querySelector('.table-data-row'))`, returnByValue: true });
    if (chk.result && chk.result.value) break;
  }
  await new Promise(r => setTimeout(r, 600));

  const diag = await send('Runtime.evaluate', {
    expression: `(() => {
      const contentArea = document.querySelector('.crm-content-area');
      const custContainer = document.querySelector('.crm-customer-page-container');
      const masterCard = document.querySelector('.customer-master-card');
      const tableWrap = document.querySelector('.crm-table-scroll-wrap');
      const getProps = (el) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          height: rect.height,
          display: cs.display,
          flex: cs.flex,
          heightProp: cs.height,
          maxHeight: cs.maxHeight,
          overflow: cs.overflow
        };
      };
      return {
        contentArea: getProps(contentArea),
        custContainer: getProps(custContainer),
        masterCard: getProps(masterCard),
        tableWrap: getProps(tableWrap)
      };
    })()`,
    returnByValue: true
  });
  console.log('DIAG:', JSON.stringify(diag.result.value, null, 2));

  ws.close();
  chrome.kill();
}
run().catch(console.error);
