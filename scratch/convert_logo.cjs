const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9691;
const USER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_canvas_'));

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ]);

  try {
    let tabs = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        if (res.ok) {
          tabs = await res.json();
          if (tabs && tabs.length > 0) break;
        }
      } catch (_) {}
    }
    const pageTab = tabs.find((t) => t.type === 'page') || tabs[0];
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const msgId = ++id;
        const handler = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === msgId) {
            ws.removeEventListener('message', handler);
            if (d.error) rej(d.error);
            else res(d.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');

    const jpgBase64 = fs.readFileSync('scratch/api_logo.jpg').toString('base64');
    const dataUri = 'data:image/jpeg;base64,' + jpgBase64;

    const evalRes = await send('Runtime.evaluate', {
      expression: `new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i+1], b = d[i+2];
            // If near white, make transparent
            if (r > 240 && g > 240 && b > 240) {
              d[i+3] = 0;
            } else if (r > 215 && g > 215 && b > 215) {
              const lum = (r + g + b) / 3;
              d[i+3] = Math.round(255 * (1 - (lum - 215) / (255 - 215)));
            }
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = '${dataUri}';
      })`,
      awaitPromise: true,
      returnByValue: true
    });

    const pngDataUrl = evalRes.result.value;
    const pngBuf = Buffer.from(pngDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync('scratch/asi_watermark_transparent.png', pngBuf);
    fs.writeFileSync('frontend/src/assets/asi_watermark_logo.png', pngBuf);
    console.log('Saved scratch/asi_watermark_transparent.png and frontend/src/assets/asi_watermark_logo.png, size:', pngBuf.length);
    ws.close();
    chrome.kill();
  } catch (err) {
    console.error(err);
    chrome.kill();
  }
}
run();
