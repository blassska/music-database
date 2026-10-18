// API helpers
const fetchAPI = async (url, options = {}) => fetch(url, options).then(r => r.ok ? r.json() : Promise.reject(new Error('API request failed')));

const showEmpty = (container, message) => container.innerHTML = `<div class="empty">${message}</div>`;

const formatDuration = duration => duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}` : '';

// Tab switching
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  
  event.target.classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  const actions = {
    artists: () => loadArtists(),
    songs: () => { loadSongs(); loadArtistsSelect('song-artist'); },
    albums: () => { loadAlbums(); loadArtistsSelect('album-artist'); },
    search: () => { loadArtistsSelect('search-artist'); loadSongsSelect('search-song'); }
  };
  actions[tabName]?.();
}

// Artists
async function loadArtists() {
  try {
    const artists = await fetchAPI('/api/artists');
    const list = document.getElementById('artists-list');
    if (artists.length === 0) return showEmpty(list, 'Нет артистов');
    
    list.innerHTML = artists.map(artist => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${artist.name}</div>
            <div class="card-meta">${artist.type === 'group' ? 'Группа' : 'Сольный исполнитель'}</div>
          </div>
          <button class="btn-icon btn-icon-danger" onclick="deleteArtist(${artist.id})" title="Удалить">×</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading artists:', error);
  }
}

async function addArtist() {
  const name = document.getElementById('artist-name').value;
  const type = document.getElementById('artist-type').value;
  if (!name) return alert('Введите название');
  
  try {
    await fetchAPI('/api/artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type })
    });
    document.getElementById('artist-name').value = '';
    loadArtists();
  } catch (error) {
    alert('Ошибка при добавлении артиста');
  }
}

async function deleteArtist(id) {
  try {
    await fetchAPI(`/api/artists/${id}`, { method: 'DELETE' });
    loadArtists();
  } catch (error) {
    alert('Ошибка при удалении артиста');
  }
}

// Songs
async function loadSongs() {
  try {
    const songs = await fetchAPI('/api/songs');
    const list = document.getElementById('songs-list');
    if (songs.length === 0) return showEmpty(list, 'Нет песен');
    
    list.innerHTML = songs.map(song => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${song.title}</div>
            <div class="card-meta">${song.artist_name}</div>
            ${song.duration ? `<div class="card-meta">${formatDuration(song.duration)}</div>` : ''}
          </div>
          <button class="btn-icon btn-icon-danger" onclick="deleteSong(${song.id})" title="Удалить">×</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading songs:', error);
  }
}

async function addSong() {
  const title = document.getElementById('song-title').value;
  const artist_id = document.getElementById('song-artist').value;
  const duration = document.getElementById('song-duration').value;
  if (!title || !artist_id) return alert('Заполните все обязательные поля');
  
  try {
    await fetchAPI('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist_id: parseInt(artist_id), duration: duration ? parseInt(duration) : null })
    });
    document.getElementById('song-title').value = '';
    document.getElementById('song-duration').value = '';
    loadSongs();
  } catch (error) {
    alert('Ошибка при добавлении песни');
  }
}

async function deleteSong(id) {
  try {
    await fetchAPI(`/api/songs/${id}`, { method: 'DELETE' });
    loadSongs();
  } catch (error) {
    alert('Ошибка при удалении песни');
  }
}

// Albums
async function loadAlbums() {
  try {
    const albums = await fetchAPI('/api/albums');
    const list = document.getElementById('albums-list');
    if (albums.length === 0) return showEmpty(list, 'Нет альбомов');
    
    list.innerHTML = await Promise.all(albums.map(async album => {
      const details = await fetchAPI(`/api/albums/${album.id}`);
      const allSongs = await fetchAPI('/api/songs');
      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${album.title}</div>
              <div class="card-meta">${album.artist_name}</div>
              ${album.release_year ? `<div class="card-meta">${album.release_year}</div>` : ''}
            </div>
            <div class="card-actions">
              <button class="btn btn-small btn-secondary" onclick="toggleAddSong(${album.id})">+ Песня</button>
              <button class="btn-icon btn-icon-danger" onclick="deleteAlbum(${album.id})" title="Удалить">×</button>
            </div>
          </div>
          <div id="add-song-form-${album.id}" style="display: none; margin-top: var(--space-sm);">
            <div style="display: grid; gap: var(--space-sm); position: relative; z-index: 2;">
              <select id="song-select-${album.id}" style="padding: var(--space-sm); background: var(--surface-3); border: 1px solid var(--surface-4); border-radius: 0.5rem; color: var(--text); font-family: var(--font-sans); font-size: var(--text-base);">
                <option value="">Выберите песню</option>
                ${allSongs.map(song => `<option value="${song.id}">${song.title} - ${song.artist_name}</option>`).join('')}
              </select>
              <input type="number" id="track-number-${album.id}" placeholder="Номер трека" style="padding: var(--space-sm); background: var(--surface-3); border: 1px solid var(--surface-4); border-radius: 0.5rem; color: var(--text); font-family: var(--font-sans); font-size: var(--text-base);">
              <button class="btn btn-small btn-primary" onclick="addSongToAlbum(${album.id})">Добавить</button>
            </div>
          </div>
          ${details.songs?.length > 0 ? `
            <div class="song-list">
              ${details.songs.map(song => `
                <div class="song-item">
                  <span>${song.track_number ? song.track_number + '. ' : ''}${song.title}</span>
                  <button class="btn-icon btn-icon-danger" onclick="removeSongFromAlbum(${album.id}, ${song.id})" title="Удалить из альбома">×</button>
                </div>
              `).join('')}
            </div>
          ` : '<div class="card-meta">Нет песен в альбоме</div>'}
        </div>
      `;
    })).then(cards => cards.join(''));
  } catch (error) {
    console.error('Error loading albums:', error);
  }
}

const toggleAddSong = albumId => {
  const form = document.getElementById(`add-song-form-${albumId}`);
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

async function addSongToAlbum(albumId) {
  const songId = document.getElementById(`song-select-${albumId}`).value;
  const trackNumber = document.getElementById(`track-number-${albumId}`).value;
  if (!songId) return alert('Выберите песню');
  
  try {
    await fetchAPI(`/api/albums/${albumId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: parseInt(songId), track_number: trackNumber ? parseInt(trackNumber) : null })
    });
    loadAlbums();
  } catch (error) {
    alert('Ошибка при добавлении песни в альбом');
  }
}

async function removeSongFromAlbum(albumId, songId) {
  try {
    await fetchAPI(`/api/albums/${albumId}/songs/${songId}`, { method: 'DELETE' });
    loadAlbums();
  } catch (error) {
    alert('Ошибка при удалении песни из альбома');
  }
}

async function addAlbum() {
  const title = document.getElementById('album-title').value;
  const artist_id = document.getElementById('album-artist').value;
  const release_year = document.getElementById('album-year').value;
  if (!title || !artist_id) return alert('Заполните все обязательные поля');
  
  try {
    await fetchAPI('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, artist_id: parseInt(artist_id), release_year: release_year ? parseInt(release_year) : null })
    });
    document.getElementById('album-title').value = '';
    document.getElementById('album-year').value = '';
    loadAlbums();
  } catch (error) {
    alert('Ошибка при добавлении альбома');
  }
}

async function deleteAlbum(id) {
  try {
    await fetchAPI(`/api/albums/${id}`, { method: 'DELETE' });
    loadAlbums();
  } catch (error) {
    alert('Ошибка при удалении альбома');
  }
}

// Helper: Load artists/songs into select
async function loadArtistsSelect(selectId) {
  try {
    const artists = await fetchAPI('/api/artists');
    document.getElementById(selectId).innerHTML = '<option value="">Выберите артиста</option>' + 
      artists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  } catch (error) {
    console.error('Error loading artists select:', error);
  }
}

async function loadSongsSelect(selectId) {
  try {
    const songs = await fetchAPI('/api/songs');
    document.getElementById(selectId).innerHTML = '<option value="">Выберите песню</option>' + 
      songs.map(s => `<option value="${s.id}">${s.title} - ${s.artist_name}</option>`).join('');
  } catch (error) {
    console.error('Error loading songs select:', error);
  }
}

// Search functions
async function searchSongsByArtist() {
  const artistId = document.getElementById('search-artist').value;
  const resultDiv = document.getElementById('artist-songs-result');
  if (!artistId) return resultDiv.innerHTML = '';
  
  try {
    const songs = await fetchAPI(`/api/artists/${artistId}/songs`);
    if (songs.length === 0) return showEmpty(resultDiv, 'Нет песен у этого артиста');
    
    resultDiv.innerHTML = `<div class="grid">${songs.map(song => `
      <div class="card">
        <div class="card-title">${song.title}</div>
        <div class="card-meta">${song.artist_name}</div>
        ${song.duration ? `<div class="card-meta">${formatDuration(song.duration)}</div>` : ''}
      </div>
    `).join('')}</div>`;
  } catch (error) {
    alert('Ошибка при поиске песен');
  }
}

async function searchAlbumsBySong() {
  const songId = document.getElementById('search-song').value;
  const resultDiv = document.getElementById('song-albums-result');
  if (!songId) return resultDiv.innerHTML = '';
  
  try {
    const albums = await fetchAPI(`/api/songs/${songId}/albums`);
    if (albums.length === 0) return showEmpty(resultDiv, 'Эта песня не входит ни в один альбом');
    
    resultDiv.innerHTML = `<div class="grid">${albums.map(album => `
      <div class="card">
        <div class="card-title">${album.title}</div>
        <div class="card-meta">${album.artist_name}</div>
        ${album.release_year ? `<div class="card-meta">${album.release_year}</div>` : ''}
        <div class="card-meta">Трек №${album.track_number || 'не указан'}</div>
      </div>
    `).join('')}</div>`;
  } catch (error) {
    alert('Ошибка при поиске альбомов');
  }
}

// Particles animation
function createParticles() {
  const container = document.querySelector('.background-decor');
  const particles = ['♪', '♫', '♬', '♩', '♭', '♯', '𝄞'];
  
  setInterval(() => {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = particles[Math.floor(Math.random() * particles.length)];
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 3 + 4) + 's';
    particle.style.fontSize = (Math.random() * 20 + 15) + 'px';
    particle.style.opacity = Math.random() * 0.3 + 0.1;
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 7000);
  }, 800);
}

// Initialize
loadArtists();
createParticles();
