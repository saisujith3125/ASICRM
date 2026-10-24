const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9698;
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_tbl_'));
const chrome = spawn(CHROME_PATH, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  'about:blank'
]);

async function run() {
  await new Promise(r => setTimeout(r, 1200));
  const res = await fetch(`http://localhost:${PORT}/json/list`);
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || tabs.find(t => t.type === 'page') || tabs[0];
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
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.evaluate', {
    expression: `(() => {
      const user = { id: 'USR-001', name: 'Super Admin', role: 'SUPER_ADMIN', status: 'Active', permissions: { Enquiries: ['View', 'Create', 'Edit', 'Delete'], Stocks: ['View', 'Create', 'Edit', 'Delete'] } };
      localStorage.setItem('asicrm_user', JSON.stringify(user));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('token', 'mock-token');
    })()`
  });

  // Check Brands table
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/stocks/brands' });
  await new Promise(r => setTimeout(r, 2500));
  const pageCheck = await send('Runtime.evaluate', { expression: '({ url: window.location.href, text: document.body.innerText.slice(0, 150) })', returnByValue: true });
  console.log('PAGE CHECK:', pageCheck.result.value);
  const brandsInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const table = document.querySelector('table');
      const ths = Array.from(document.querySelectorAll('th')).map(th => ({ text: th.innerText, borderRight: getComputedStyle(th).borderRight, fontSize: getComputedStyle(th).fontSize, width: th.offsetWidth }));
      const tds = Array.from(document.querySelectorAll('tbody tr:first-child td')).map(td => ({ text: td.innerText, borderRight: getComputedStyle(td).borderRight, fontSize: getComputedStyle(td).fontSize, padding: getComputedStyle(td).padding }));
      const shell = document.querySelector('.settings-table-shell') || document.querySelector('.crm-table-workspace');
      return { ths, tds, tableClass: table ? table.className : '', shellClass: shell ? shell.className : '', shellBorder: shell ? getComputedStyle(shell).border : '' };
    })()`,
    returnByValue: true
  });
  console.log('BRANDS TABLE INFO:\n', JSON.stringify(brandsInfo.result.value, null, 2));

  // Check Enquiries table
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/enquiries' });
  await new Promise(r => setTimeout(r, 2000));
  const enquiryInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const table = document.querySelector('table');
      const ths = Array.from(document.querySelectorAll('th')).map(th => ({ text: th.innerText, borderRight: getComputedStyle(th).borderRight, fontSize: getComputedStyle(th).fontSize, width: th.offsetWidth }));
      const tds = Array.from(document.querySelectorAll('tbody tr:first-child td')).map(td => ({ text: td.innerText, borderRight: getComputedStyle(td).borderRight, fontSize: getComputedStyle(td).fontSize, padding: getComputedStyle(td).padding }));
      const shell = document.querySelector('.settings-table-shell') || document.querySelector('.crm-table-workspace');
      const row = document.querySelector('tbody tr:first-child');
      const enqIdLink = document.querySelector('.enquiry-id-link');
      const custLink = document.querySelector('.customer-name-link');
      const pBadge = document.querySelector('.priority-badge');
      const sBadge = document.querySelector('.status-badge');
      return {
        ths,
        tds,
        tableClass: table ? table.className : '',
        shellClass: shell ? shell.className : '',
        shellBorder: shell ? getComputedStyle(shell).border : '',
        fonts: {
          enqIdLink: enqIdLink ? getComputedStyle(enqIdLink).fontSize : null,
          custLink: custLink ? getComputedStyle(custLink).fontSize : null,
          pBadge: pBadge ? getComputedStyle(pBadge).fontSize : null,
          sBadge: sBadge ? getComputedStyle(sBadge).fontSize : null
        }
      };
    })()`,
    returnByValue: true
  });
  console.log('ENQUIRIES TABLE INFO:\n', JSON.stringify(enquiryInfo.result.value, null, 2));

  ws.close();
  chrome.kill();
}
run();
