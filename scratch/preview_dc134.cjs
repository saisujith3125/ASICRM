const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_doc_preview_'));
const ARTIFACTS_DIR = 'C:\\Users\\gotindia\\.gemini\\antigravity\\brain\\60245ec2-db07-4a60-9e96-08a10130208f';

async function run() {
  const port = 9448;
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--window-size=1440,1050',
    'about:blank'
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  const tabs = await (await fetch(`http://localhost:${port}/json/list`)).json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 1;
  const send = (m, p = {}) =>
    new Promise((res, rej) => {
      const cur = id++;
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === cur) res(d.result);
      };
      ws.send(JSON.stringify({ id: cur, method: m, params: p }));
    });
  await send('Page.enable');
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
  await new Promise((r) => setTimeout(r, 1000));
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('asicrm_user', JSON.stringify({ id: 'USR-003', name: 'John Doe', role: 'SUPER_ADMIN', permissions: { 'Delivery Challans': { view: true, create: true, edit: true, delete: true } } }));`
  });
  await send('Page.navigate', { url: 'https://crmapi.asiind.com/delivery-challans/dispatch' });
  await new Promise((r) => setTimeout(r, 2000));

  // Click DC/001/2026 link to open document preview modal
  await send('Runtime.evaluate', {
    expression: `(() => { const link = Array.from(document.querySelectorAll('button, a, td')).find(el => el.innerText.trim() === 'DC/001/2026' || el.innerText.trim() === 'DC-000134'); if (link) link.click(); })()`
  });
  await new Promise((r) => setTimeout(r, 1500));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'test_dc_000134_preview_ref_no.png'), Buffer.from(shot.data, 'base64'));
  console.log('Saved test_dc_000134_preview_ref_no.png');

  ws.close();
  chromeProcess.kill();
  try {
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  } catch (_) {}
}
run();
