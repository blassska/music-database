import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Middleware для обработки ошибок
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => 
    res.status(500).json({ error: err.message })
  );
};

// Общие SQL-запросы
const queries = {
  songWithArtist: `SELECT s.*, a.name as artist_name FROM songs s JOIN artists a ON s.artist_id = a.id WHERE s.id = ?`,
  allSongs: `SELECT s.*, a.name as artist_name FROM songs s JOIN artists a ON s.artist_id = a.id ORDER BY s.title`,
  albumWithArtist: `SELECT alb.*, a.name as artist_name FROM albums alb JOIN artists a ON alb.artist_id = a.id WHERE alb.id = ?`,
  allAlbums: `SELECT alb.*, a.name as artist_name FROM albums alb JOIN artists a ON alb.artist_id = a.id ORDER BY alb.title`
};

// API для артистов
app.get('/api/artists', asyncHandler(async (req, res) => {
  const artists = db.prepare('SELECT * FROM artists ORDER BY name').all();
  res.json(artists);
}));

app.get('/api/artists/:id', asyncHandler(async (req, res) => {
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(req.params.id);
  if (!artist) return res.status(404).json({ error: 'Артист не найден' });
  res.json(artist);
}));

app.post('/api/artists', asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Необходимы поля name и type' });
  const result = db.prepare('INSERT INTO artists (name, type) VALUES (?, ?)').run(name, type);
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(artist);
}));

app.put('/api/artists/:id', asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  db.prepare('UPDATE artists SET name = ?, type = ? WHERE id = ?').run(name, type, req.params.id);
  res.json(db.prepare('SELECT * FROM artists WHERE id = ?').get(req.params.id));
}));

app.delete('/api/artists/:id', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM artists WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// API для песен
app.get('/api/songs', asyncHandler(async (req, res) => {
  res.json(db.prepare(queries.allSongs).all());
}));

app.get('/api/songs/:id', asyncHandler(async (req, res) => {
  const song = db.prepare(queries.songWithArtist).get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Песня не найдена' });
  res.json(song);
}));

app.post('/api/songs', asyncHandler(async (req, res) => {
  const { title, artist_id, duration } = req.body;
  if (!title || !artist_id) return res.status(400).json({ error: 'Необходимы поля title и artist_id' });
  const result = db.prepare('INSERT INTO songs (title, artist_id, duration) VALUES (?, ?, ?)').run(title, artist_id, duration || null);
  res.status(201).json(db.prepare(queries.songWithArtist).get(result.lastInsertRowid));
}));

app.put('/api/songs/:id', asyncHandler(async (req, res) => {
  const { title, artist_id, duration } = req.body;
  db.prepare('UPDATE songs SET title = ?, artist_id = ?, duration = ? WHERE id = ?').run(title, artist_id, duration, req.params.id);
  res.json(db.prepare(queries.songWithArtist).get(req.params.id));
}));

app.delete('/api/songs/:id', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

app.get('/api/artists/:id/songs', asyncHandler(async (req, res) => {
  res.json(db.prepare(`${queries.allSongs.replace('ORDER BY s.title', 'WHERE s.artist_id = ? ORDER BY s.title')}`).all(req.params.id));
}));

// API для альбомов
app.get('/api/albums', asyncHandler(async (req, res) => {
  res.json(db.prepare(queries.allAlbums).all());
}));

app.get('/api/albums/:id', asyncHandler(async (req, res) => {
  const album = db.prepare(queries.albumWithArtist).get(req.params.id);
  if (!album) return res.status(404).json({ error: 'Альбом не найден' });
  album.songs = db.prepare('SELECT s.*, als.track_number FROM songs s JOIN album_songs als ON s.id = als.song_id WHERE als.album_id = ? ORDER BY als.track_number').all(req.params.id);
  res.json(album);
}));

app.post('/api/albums', asyncHandler(async (req, res) => {
  const { title, artist_id, release_year } = req.body;
  if (!title || !artist_id) return res.status(400).json({ error: 'Необходимы поля title и artist_id' });
  const result = db.prepare('INSERT INTO albums (title, artist_id, release_year) VALUES (?, ?, ?)').run(title, artist_id, release_year || null);
  res.status(201).json(db.prepare(queries.albumWithArtist).get(result.lastInsertRowid));
}));

app.put('/api/albums/:id', asyncHandler(async (req, res) => {
  const { title, artist_id, release_year } = req.body;
  db.prepare('UPDATE albums SET title = ?, artist_id = ?, release_year = ? WHERE id = ?').run(title, artist_id, release_year, req.params.id);
  res.json(db.prepare(queries.albumWithArtist).get(req.params.id));
}));

app.delete('/api/albums/:id', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM albums WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

app.post('/api/albums/:id/songs', asyncHandler(async (req, res) => {
  const { song_id, track_number } = req.body;
  if (!song_id) return res.status(400).json({ error: 'Необходимо поле song_id' });
  db.prepare('INSERT INTO album_songs (album_id, song_id, track_number) VALUES (?, ?, ?)').run(req.params.id, song_id, track_number || null);
  res.status(201).json({ success: true });
}));

app.delete('/api/albums/:albumId/songs/:songId', asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM album_songs WHERE album_id = ? AND song_id = ?').run(req.params.albumId, req.params.songId);
  res.json({ success: true });
}));

app.get('/api/songs/:id/albums', asyncHandler(async (req, res) => {
  res.json(db.prepare('SELECT DISTINCT alb.*, a.name as artist_name, als.track_number FROM albums alb JOIN artists a ON alb.artist_id = a.id JOIN album_songs als ON alb.id = als.album_id WHERE als.song_id = ? ORDER BY alb.title').all(req.params.id));
}));

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
