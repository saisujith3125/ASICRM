const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_rule_inspect_'));

async function inspect() {
  const port = 9446;
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let idSeq = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = idSeq++;
    const handler = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === msgId) {
        ws.removeEventListener('message', handler);
        if (d.error) reject(d.error); else resolve(d.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('CSS.enable');

  await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
  await new Promise(r => setTimeout(r, 1200));

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001', name: 'Super Admin', role: 'SUPER_ADMIN',
        permissions: { 'Delivery Challans': ['View', 'Create', 'Edit', 'Delete'] }
      }));
      localStorage.setItem('token', 'mock-token');
    `
  });

  await send('Page.navigate', { url: 'https://crmapi.asiind.com/delivery-challans/DC/001/2026' });
  await new Promise(r => setTimeout(r, 3000));

  const doc = await send('DOM.getDocument');
  const node = await send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '.dc-table th'
  });

  console.log('th NodeId:', node.nodeId);
  if (node.nodeId) {
    const matched = await send('CSS.getMatchedStylesForNode', { nodeId: node.nodeId });
    console.log('Matched CSS Rules for .dc-table th:');
    matched.matchedCSSRules.forEach(r => {
      console.log('Selector:', r.rule.selectorList.text);
      r.rule.style.cssProperties.forEach(p => {
        if (p.name.includes('background') || p.name.includes('color')) {
          console.log(`  ${p.name}: ${p.value} (${p.important ? '!important' : ''})`);
        }
      });
    });
  }

  ws.close();
  chromeProcess.kill();
  fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
}

inspect().catch(console.error);
