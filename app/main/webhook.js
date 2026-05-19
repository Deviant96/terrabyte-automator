const https = require('https');
const http = require('http');
const config = require('./config');
const db = require('./database');

function send(requestId, payload, mainWindow) {
  const settings = config.getAll();
  const webhookUrl = settings.webhook_url;

  if (!webhookUrl) {
    db.updateRequest(requestId, { status: 'Error', error_message: 'Webhook URL not configured.' });
    if (mainWindow) mainWindow.webContents.send('request-update', { request_id: requestId, status: 'Error', error_message: 'Webhook URL not configured.' });
    return;
  }

  const body = JSON.stringify({
    request_id: requestId,
    prompt: payload.prompt,
    keyword: payload.keyword || '',
    platform: payload.platform || '',
    urgent: !!payload.urgent,
    schedule_date: payload.schedule_date || '',
    article_schedule_time: payload.article_schedule_time || '',
    article_schedule_week: payload.article_schedule_week || 'this_week',
    article_schedule_start_date: payload.article_schedule_start_date || payload.schedule_date || ''
  });

  let url;
  try {
    url = new URL(webhookUrl);
  } catch {
    db.updateRequest(requestId, { status: 'Error', error_message: 'Invalid webhook URL.' });
    if (mainWindow) mainWindow.webContents.send('request-update', { request_id: requestId, status: 'Error', error_message: 'Invalid webhook URL.' });
    return;
  }

  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...(settings.webhook_token ? { 'Authorization': `Bearer ${settings.webhook_token}` } : {})
    },
    timeout: settings.webhook_timeout || 30000
  };

  db.updateRequest(requestId, { status: 'Processing' });
  if (mainWindow) mainWindow.webContents.send('request-update', { request_id: requestId, status: 'Processing' });

  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try {
        let output = data;
        // Try parsing as JSON and extract output field if present
        try {
          const parsed = JSON.parse(data);
          if (parsed.output) output = parsed.output;
          else if (parsed.result) output = parsed.result;
          else if (parsed.content) output = parsed.content;
          else output = JSON.stringify(parsed, null, 2);
        } catch { /* not JSON, use raw */ }

        db.updateRequest(requestId, { status: 'Completed', output });
        if (mainWindow) mainWindow.webContents.send('request-update', {
          request_id: requestId,
          status: 'Completed',
          output
        });
        if (mainWindow) mainWindow.webContents.send('toast', { type: 'success', message: 'AI response completed' });
      } catch (e) {
        db.updateRequest(requestId, { status: 'Error', error_message: e.message });
        if (mainWindow) mainWindow.webContents.send('request-update', { request_id: requestId, status: 'Error', error_message: e.message });
      }
    });
  });

  req.on('timeout', () => {
    req.destroy();
    db.updateRequest(requestId, { status: 'Error', error_message: 'Request timed out.' });
    if (mainWindow) mainWindow.webContents.send('request-update', { request_id: requestId, status: 'Error', error_message: 'Request timed out.' });
    if (mainWindow) mainWindow.webContents.send('toast', { type: 'error', message: 'Webhook connection timed out' });
  });

  req.on('error', (e) => {
    db.updateRequest(requestId, { status: 'Error', error_message: e.message });
    if (mainWindow) mainWindow.webContents.send('request-update', { request_id: requestId, status: 'Error', error_message: e.message });
    if (mainWindow) mainWindow.webContents.send('toast', { type: 'error', message: 'Unable to connect to n8n.' });
  });

  req.write(body);
  req.end();
}

async function test() {
  const settings = config.getAll();
  const webhookUrl = settings.webhook_url;
  if (!webhookUrl) return { success: false, message: 'Webhook URL not configured.' };

  return new Promise((resolve) => {
    let url;
    try { url = new URL(webhookUrl); } catch { return resolve({ success: false, message: 'Invalid webhook URL.' }); }

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength('{"test":true}'),
        ...(settings.webhook_token ? { 'Authorization': `Bearer ${settings.webhook_token}` } : {})
      },
      timeout: 8000
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      resolve({ success: res.statusCode < 500, message: `HTTP ${res.statusCode}` });
    });
    req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timed out.' }); });
    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.write('{"test":true}');
    req.end();
  });
}

module.exports = { send, test };
