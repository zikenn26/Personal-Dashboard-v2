const http = require('http');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sendWs(wsUrl, method, params = {}) {
  const WebSocket = require('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = 1;
    ws.on('open', () => {
      ws.send(JSON.stringify({ id, method, params }));
    });
    ws.on('message', (msg) => {
      const res = JSON.parse(msg);
      if (res.id === id) {
        ws.close();
        resolve(res.result);
      }
    });
    ws.on('error', reject);
  });
}

async function main() {
  const views = [
    { name: '01_command_center_dashboard', view: 'home', width: 1440, height: 900, isMobile: false },
    { name: '02_tasks_kanban', view: 'tasks', width: 1440, height: 900, isMobile: false },
    { name: '03_habit_tracker', view: 'habits', width: 1440, height: 900, isMobile: false },
    { name: '04_goals_roadmap', view: 'goals', width: 1440, height: 900, isMobile: false },
    { name: '05_spending_finance', view: 'expenses', width: 1440, height: 900, isMobile: false },
    { name: '06_screentime_analytics', view: 'screentime', width: 1440, height: 900, isMobile: false },
    { name: '07_ai_assistant', view: 'assistant', width: 1440, height: 900, isMobile: false },
    { name: '08_exam_preparation', view: 'exams', width: 1440, height: 900, isMobile: false },
    { name: '09_workfolio_career', view: 'workfolio', width: 1440, height: 900, isMobile: false },
    { name: '10_password_vault', view: 'vault', width: 1440, height: 900, isMobile: false },
    // Mobile viewport captures
    { name: 'mobile_01_home_dashboard', view: 'home', width: 412, height: 915, isMobile: true },
    { name: 'mobile_02_spending_tracker', view: 'expenses', width: 412, height: 915, isMobile: true },
    { name: 'mobile_03_screentime_detail', view: 'screentime', width: 412, height: 915, isMobile: true },
    { name: 'mobile_04_tasks', view: 'tasks', width: 412, height: 915, isMobile: true },
    { name: 'mobile_05_habits', view: 'habits', width: 412, height: 915, isMobile: true }
  ];

  // Start Chrome with remote debugging
  const port = 9222;
  const chromeProcess = spawn('/usr/bin/chromium', [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    'about:blank'
  ]);

  await sleep(1500);

  try {
    const tabs = await fetchJson(`http://127.0.0.1:${port}/json`);
    const tab = tabs[0];
    const wsUrl = tab.webSocketDebuggerUrl;

    const WebSocket = require('ws');

    // Create persistent WS client
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.on('open', r));

    let msgId = 1;
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      const handler = (raw) => {
        const msg = JSON.parse(raw);
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await call('Page.enable');
    await call('Runtime.enable');

    // Seed mock data for rich demonstration without personal private data
    await call('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(2000);

    for (const v of views) {
      console.log(`Setting up ${v.name} (view: ${v.view})...`);
      
      // Set viewport
      await call('Emulation.setDeviceMetricsOverride', {
        width: v.width,
        height: v.height,
        deviceScaleFactor: 2,
        mobile: v.isMobile
      });

      // Navigate to view via UI interaction / state trigger
      await call('Runtime.evaluate', {
        expression: `
          (function() {
            // Find navigation button or dispatch event
            const navBtn = document.querySelector('[data-view="${v.view}"]') ||
                           Array.from(document.querySelectorAll('button, a')).find(el => {
                             const text = (el.innerText || '').toLowerCase();
                             const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                             if ('${v.view}' === 'home') return text.includes('home') || text.includes('dashboard');
                             if ('${v.view}' === 'tasks') return text.includes('task') || text.includes('kanban');
                             if ('${v.view}' === 'habits') return text.includes('habit');
                             if ('${v.view}' === 'goals') return text.includes('goal');
                             if ('${v.view}' === 'expenses') return text.includes('spending') || text.includes('expense');
                             if ('${v.view}' === 'screentime') return text.includes('screen');
                             if ('${v.view}' === 'assistant') return text.includes('assistant') || text.includes('secretary') || text.includes('ai');
                             if ('${v.view}' === 'exams') return text.includes('exam');
                             if ('${v.view}' === 'workfolio') return text.includes('workfolio') || text.includes('portfolio') || text.includes('career');
                             if ('${v.view}' === 'vault') return text.includes('vault') || text.includes('password');
                             return false;
                           });
            if (navBtn) {
              navBtn.click();
            } else {
              window.dispatchEvent(new CustomEvent('navigate-view', { detail: '${v.view}' }));
            }
          })()
        `
      });

      await sleep(1500);

      // Capture screenshot
      const { data } = await call('Page.captureScreenshot', { format: 'png' });
      const filePath = `docs/assets/screenshots/${v.name}.png`;
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`Saved ${filePath} (${fs.statSync(filePath).size} bytes)`);
    }

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error('CDP capture error:', err);
  process.exit(1);
});
