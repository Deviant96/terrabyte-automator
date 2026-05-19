const path = require('path');
const fs = require('fs');
const config = require('./config');

let db = null;
let SQL = null;
let dbFilePath = null;

function getDbPath() {
  const settings = config.getAll();
  return settings.database_path || path.join(__dirname, '../database/app.db');
}

function persist() {
  if (!db || !dbFilePath) return;
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

async function initDb() {
  if (db) return;
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '../../node_modules/sql.js/dist/', file)
  });
  dbFilePath = getDbPath();
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  migrate();
}

function migrate() {
  db.run(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT UNIQUE,
    prompt TEXT,
    keyword TEXT,
    platform TEXT,
    urgent INTEGER DEFAULT 0,
    schedule_date TEXT,
    article_schedule_time TEXT DEFAULT '',
    article_schedule_week TEXT DEFAULT 'this_week',
    article_schedule_start_date TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    output TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    created_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);

  const columns = all('PRAGMA table_info(requests)');
  if (!columns.some((column) => column.name === 'article_schedule_time')) {
    db.run("ALTER TABLE requests ADD COLUMN article_schedule_time TEXT DEFAULT '';");
  }
  if (!columns.some((column) => column.name === 'article_schedule_week')) {
    db.run("ALTER TABLE requests ADD COLUMN article_schedule_week TEXT DEFAULT 'this_week'");
  }
  if (!columns.some((column) => column.name === 'article_schedule_start_date')) {
    db.run("ALTER TABLE requests ADD COLUMN article_schedule_start_date TEXT DEFAULT ''");
  }

  persist();
}

function sqlRun(sql, params) {
  db.run(sql, params);
  persist();
}

function all(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params) { return all(sql, params)[0] || null; }

function insertRequest(record) {
  sqlRun(`INSERT OR REPLACE INTO requests
    (request_id, prompt, keyword, platform, urgent, schedule_date, article_schedule_time, article_schedule_week, article_schedule_start_date, status, output, error_message, created_at, updated_at)
    VALUES (:request_id,:prompt,:keyword,:platform,:urgent,:schedule_date,:article_schedule_time,:article_schedule_week,:article_schedule_start_date,:status,:output,:error_message,:created_at,:updated_at)`,
    { ':request_id':record.request_id,':prompt':record.prompt,':keyword':record.keyword||'',
      ':platform':record.platform||'',':urgent':record.urgent||0,':schedule_date':record.schedule_date||'',
      ':article_schedule_time':record.article_schedule_time||'',':article_schedule_week':record.article_schedule_week||'this_week',':article_schedule_start_date':record.article_schedule_start_date||record.schedule_date||'',
      ':status':record.status||'Pending',':output':record.output||'',':error_message':record.error_message||'',
      ':created_at':record.created_at,':updated_at':record.updated_at });
}

function updateRequest(requestId, fields) {
  const now = new Date().toISOString();
  const allFields = { ...fields, updated_at: now };
  const setParts = Object.keys(allFields).map(k => k + ' = :' + k).join(', ');
  const params = { ':request_id': requestId };
  Object.entries(allFields).forEach(([k,v]) => { params[':'+k] = v; });
  sqlRun('UPDATE requests SET ' + setParts + ' WHERE request_id = :request_id', params);
}

function getAllRequests() { return all('SELECT * FROM requests ORDER BY created_at DESC'); }
function getRequest(id) { return get('SELECT * FROM requests WHERE request_id = ?', [id]); }
function deleteRequest(id) { sqlRun('DELETE FROM requests WHERE request_id = ?', [id]); }
function clearAll() { sqlRun('DELETE FROM requests'); }

module.exports = { initDb, insertRequest, updateRequest, getAllRequests, getRequest, deleteRequest, clearAll };
