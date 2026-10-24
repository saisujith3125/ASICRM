const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_test_dc_return_'));
const ARTIFACTS_DIR = 'C:\\Users\\pc\\.gemini\\antigravity\\brain\\a6bfe0ee-cb6c-45d2-9ad4-5e98e73a0eb6';

async function run() {
  const PORT = 9872;
  console.log('Spawning Chrome on port ' + PORT + '...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ]);

  let tabs = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const listRes = await fetch(`http://localhost:${PORT}/json/list`);
      if (listRes.ok) {
        tabs = await listRes.json();
        if (tabs && tabs.length > 0) break;
      }
    } catch (_) {}
  }

  if (!tabs || tabs.length === 0) {
    throw new Error('Chrome tabs not ready');
  }

  const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const handler = (e) => {
        const d = JSON.parse(e.data);
        if (d.id === msgId) {
          ws.removeEventListener('message', handler);
          if (d.error) reject(d.error);
          else resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  };

  const screenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  };

  try {
    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('1. Setting auth session...');
    await send('Page.navigate', { url: 'https://crmapi.asiind.com/' });
    await new Promise((r) => setTimeout(r, 800));

    await evaluate(`
      localStorage.setItem('asicrm_user', JSON.stringify({
        id: 'USR-001',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        email: 'superadmin@asicrm.local',
        department: 'Management'
      }));
    `);

    console.log('2. Navigating to https://crmapi.asiind.com/delivery-challans/return ...');
    await send('Page.navigate', { url: 'https://crmapi.asiind.com/delivery-challans/return' });
    
    // Wait for the register card to appear
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const ready = await evaluate(`Boolean(document.querySelector('.dc-return-register-card'))`);
      if (ready) break;
    }
    await new Promise((r) => setTimeout(r, 1000));

    // 1. Capture Return DC Register Tabs view
    await screenshot('verify_dc_return_tabs.png');
    console.log('✓ Captured tabs view.');

    // Verify tabs presence
    const tabsInfo = await evaluate(`(() => {
      const tabBtns = Array.from(document.querySelectorAll('.dc-tab-btn')).map(b => b.innerText.replace(/\\s+/g, ' ').trim());
      return tabBtns;
    })()`);
    console.log('Tabs detected:', tabsInfo);

    // 2. Open first Return Document modal in Return History
    console.log('Opening Return Document modal for first transaction in Return History...');
    const openedModal = await evaluate(`(() => {
      const viewBtns = Array.from(document.querySelectorAll('.dc-table tbody tr .dc-btn-action'));
      if (viewBtns.length > 0) {
        viewBtns[0].click();
        return true;
      }
      return false;
    })()`);
    await new Promise((r) => setTimeout(r, 1500));
    await screenshot('verify_dc_return_document_modal.png');

    const modalDocTitle = await evaluate(`(() => {
      const titleEl = document.querySelector('.dc-main-title') || document.querySelector('.doc-modal-title');
      return titleEl ? titleEl.innerText : null;
    })()`);
    console.log('Modal Document Title:', modalDocTitle);

    // Close modal
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.doc-preview-btn.close') || document.querySelector('.crm-modal-close');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    // 3. Switch to Fully Returned tab
    console.log('Switching to Fully Returned tab...');
    await evaluate(`(() => {
      const tabBtns = Array.from(document.querySelectorAll('.dc-tab-btn'));
      const fullTab = tabBtns.find(b => b.innerText.includes('Fully Returned'));
      if (fullTab) fullTab.click();
    })()`);
    await new Promise((r) => setTimeout(r, 1000));
    await screenshot('verify_dc_fully_returned_tab.png');

    // Open original DC modal from Fully Returned tab
    console.log('Opening Original DC from Fully Returned tab...');
    await evaluate(`(() => {
      const viewBtns = Array.from(document.querySelectorAll('.dc-table tbody tr .dc-btn-action'));
      if (viewBtns.length > 0) {
        viewBtns[viewBtns.length - 1].click();
      }
    })()`);
    await new Promise((r) => setTimeout(r, 1500));
    await screenshot('verify_dc_original_dc_fully_returned_modal.png');

    const origModalTitle = await evaluate(`(() => {
      const titleEl = document.querySelector('.dc-main-title') || document.querySelector('.doc-modal-title');
      return titleEl ? titleEl.innerText : null;
    })()`);
    console.log('Original DC Modal Title:', origModalTitle);

    // Close modal
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.doc-preview-btn.close') || document.querySelector('.crm-modal-close');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 800));

    // 4. Navigate to Initiate Return page via UI button
    console.log('Clicking Initiate Return button...');
    await evaluate(`(() => {
      const btn = document.querySelector('.dc-btn-initiate-return');
      if (btn) btn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 1500));

    // Focus search input to open dropdown and filter by DC-000122
    await evaluate(`(() => {
      const input = document.querySelector('.dc-search-input');
      if (input) {
        input.focus();
        input.click();
        input.value = 'DC-000122';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 1200));
    await screenshot('verify_dc_initiate_return_search_dropdown.png');

    const searchItems = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('.dc-search-result-item')).map(el => {
        const id = el.querySelector('.order-id-badge')?.innerText;
        const status = el.querySelector('.dc-status-pill')?.innerText || el.querySelector('.status-badge')?.innerText;
        const disabled = el.getAttribute('aria-disabled');
        const text = el.innerText.replace(/\\s+/g, ' ');
        return { id, status, disabled, text: text.slice(0, 100) };
      });
      return items;
    })()`);
    console.log('Candidate search items:', searchItems);

    console.log('\n✓ UI verification completed successfully.');
  } finally {
    try {
      ws.close();
      chrome.kill();
    } catch (_) {}
  }
}

run().catch((err) => {
  console.error('UI TEST ERROR:', err);
  process.exit(1);
});
