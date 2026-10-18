import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'music.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();
  
  const tables = [
    `CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('group', 'solo')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER NOT NULL,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER NOT NULL,
      release_year INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS album_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      track_number INTEGER,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
      UNIQUE(album_id, song_id)
    )`
  ];
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist_id)',
    'CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id)',
    'CREATE INDEX IF NOT EXISTS idx_album_songs_album ON album_songs(album_id)',
    'CREATE INDEX IF NOT EXISTS idx_album_songs_song ON album_songs(song_id)'
  ];
  
  tables.forEach(sql => db.run(sql));
  indexes.forEach(sql => db.run(sql));
  saveDatabase();
}

function saveDatabase() {
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function executeQuery(sql, params, method) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  if (method === 'all') {
    const result = [];
    while (stmt.step()) result.push(stmt.getAsObject());
    stmt.free();
    return result;
  }
  
  if (method === 'get') {
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  }
  
  if (method === 'run') {
    stmt.free();
    db.run(sql, params);
    saveDatabase();
    return {
      lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0].values[0][0],
      changes: db.getRowsModified()
    };
  }
}

const dbWrapper = {
  prepare: (sql) => ({
    all: (...params) => executeQuery(sql, params, 'all'),
    get: (...params) => executeQuery(sql, params, 'get'),
    run: (...params) => executeQuery(sql, params, 'run')
  })
};

await initDatabase();

export default dbWrapper;
