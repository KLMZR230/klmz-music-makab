/* =========================================================
 * CONFIGURACIÓN DE APPWRITE
 * ======================================================= */
const { Client, Account, Databases, Storage, ID, Query } = Appwrite;

const PROJECT_ID              = "68aa8307001f723f5518";
const DATABASE_ID             = "68aa8566002832b4c093";
const ALBUMS_COLLECTION_ID    = "68aa85730036dd283cc9";
const CANCIONES_COLLECTION_ID = "68aa859a00308a612142";
const STORAGE_BUCKET_ID       = "68aa8cc5003a2c336a1f";
const ADMIN_EMAIL             = "klmzr@gmail.com";

const client = new Client()
  .setEndpoint("https://nyc.cloud.appwrite.io/v1")  // tu endpoint
  .setProject(PROJECT_ID);

const account   = new Account(client);
const databases = new Databases(client);
const storage   = new Storage(client);

/* =========================================================
 * VARIABLES DE ESTADO
 * ======================================================= */
let currentSong     = null;
let currentAlbum    = null;
let currentPlaylist = [];
let isPlaying       = false;
let currentUser     = null;

/* =========================================================
 * UTILIDADES GENERALES
 * ======================================================= */
const qs = id => document.getElementById(id);
const show = el => { el.hidden = false; };
const hide = el => { el.hidden = true; };
const loading = state => state ? show(qs("loading-indicator")) : hide(qs("loading-indicator"));

/* =========================================================
 * CAMBIO DE TEMA
 * ======================================================= */
function changeTheme(theme) {
  document.body.className = theme && theme !== "default" ? `theme-${theme}` : "";
  localStorage.setItem("klmz_theme", theme);
}
function loadSavedTheme() {
  const t = localStorage.getItem("klmz_theme") || "default";
  qs("theme-select").value = t; changeTheme(t);
}

/* =========================================================
 * MENÚ DE USUARIO
 * ======================================================= */
function toggleUserMenu() {
  qs("user-dropdown").classList.toggle("show");
}
function closeUserMenuOutside(e) {
  if (!document.querySelector(".user-menu")?.contains(e.target)) {
    qs("user-dropdown").classList.remove("show");
    document.removeEventListener("click", closeUserMenuOutside);
  }
}

/* =========================================================
 * MODALES DE INFO
 * ======================================================= */
function infoModal(msg) {
  const m = document.createElement("div");
  m.className = "modal"; m.innerHTML =
    `<div class="modal-content" style="text-align:center"><p style="margin-bottom:1.5rem">${msg}</p><button class="btn-primary" onclick="this.closest('.modal').remove()">OK</button></div>`;
  document.body.appendChild(m); show(m);
}
function confirmModal(msg, cb) {
  const m = document.createElement("div");
  m.className = "modal"; m.innerHTML =
    `<div class="modal-content"><p style="text-align:center;margin-bottom:1.5rem">${msg}</p><div style="display:flex;gap:1rem;justify-content:center"><button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn-danger" id="confirm-btn">Confirmar</button></div></div>`;
  m.querySelector("#confirm-btn").onclick = () => { cb(); m.remove(); };
  document.body.appendChild(m); show(m);
}

/* =========================================================
 * SESIÓN Y AUTENTICACIÓN
 * ======================================================= */
async function checkSession() {
  try { currentUser = await account.get(); } catch { currentUser = null; }
  updateAuthUI();
}
function updateAuthUI() {
  const headerIcon = qs("header-lock-icon");
  if (currentUser) {
    show(qs("user-info-section"));
    qs("user-email-display").textContent = currentUser.email;
    hide(qs("login-menu-item")); hide(qs("register-menu-item")); show(qs("logout-menu-item"));
    if (currentUser.email === ADMIN_EMAIL) { headerIcon.textContent = "⚙️"; show(qs("admin-menu-item")); }
    else                                   { headerIcon.textContent = "👤"; hide(qs("admin-menu-item")); }
  } else {
    headerIcon.textContent = "🔒";
    hide(qs("user-info-section")); hide(qs("admin-menu-item"));
    show(qs("login-menu-item"));   show(qs("register-menu-item")); hide(qs("logout-menu-item"));
  }
}
async function login(e) {
  e.preventDefault();
  try {
    await account.createEmailSession(qs("login-email").value, qs("login-password").value);
    await checkSession(); infoModal("¡Bienvenido!"); closeAuth();
  } catch (err) { infoModal("Error de login: " + err.message); }
}
async function register(e) {
  e.preventDefault();
  const p1 = qs("register-password").value;
  const p2 = qs("register-confirm-password").value;
  if (p1 !== p2) return infoModal("Las contraseñas no coinciden");
  try {
    await account.create(ID.unique(), qs("register-email").value, p1);
    await account.createEmailSession(qs("register-email").value, p1);
    await checkSession(); infoModal("Registro exitoso"); closeAuth();
  } catch (err) { infoModal("Error: " + err.message); }
}
function confirmLogout() { confirmModal("¿Cerrar sesión?", logout); }
async function logout() {
  await account.deleteSession("current");
  currentUser = null; updateAuthUI(); infoModal("Sesión cerrada");
}

/* =========================================================
 * NAVEGACIÓN ENTRE SECCIONES
 * ======================================================= */
function showSection(sec) {
  document.querySelectorAll(".content-section").forEach(el => el.classList.remove("active"));
  qs(`${sec}-section`).classList.add("active");
  document.querySelectorAll(".bottom-nav-item").forEach(el => el.classList.remove("active"));
  qs(`nav-${sec === "favorites" ? "favs" : sec}`).classList.add("active");
  if (sec === "home")   showAlbumsGrid();
  if (sec === "admin") isAdmin() && renderAdminPanel();
}
function isAdmin() { return currentUser && currentUser.email === ADMIN_EMAIL; }

/* =========================================================
 * DATOS : ÁLBUMES Y CANCIONES
 * ======================================================= */
async function loadAllData() {
  loading(true);
  try {
    const { documents } = await databases.listDocuments(DATABASE_ID, ALBUMS_COLLECTION_ID);
    displayAlbums(documents);
  } catch {
    qs("albums").innerHTML = "<h2>No se pudieron cargar los álbumes</h2>";
  }
  loading(false);
}
function displayAlbums(albs) {
  if (!albs.length) return qs("albums").innerHTML = "<h2>No hay álbumes disponibles</h2>";
  qs("albums").innerHTML = albs.map(a => {
    const cover = storage.getFilePreview(STORAGE_BUCKET_ID, a.coverStorageId);
    return `<div class="album-card" onclick='showAlbumDetail(${JSON.stringify(a).replace(/"/g,"&quot;")})'>
              <img class="album-img" src="${cover}" alt="${a.name}" loading="lazy">
              <div class="album-title">${a.name}</div>
              <div class="album-artist">${a.artistName}</div>
            </div>`;
  }).join("");
}
async function showAlbumDetail(alb) {
  currentAlbum = alb;
  hide(qs("albums")); show(qs("album-detail"));
  const cover = storage.getFilePreview(STORAGE_BUCKET_ID, alb.coverStorageId);
  qs("album-detail").innerHTML = `
    <button class="back-btn" onclick="showAlbumsGrid()">⟵ Volver</button>
    <div style="text-align:center;margin-bottom:2rem">
      <img class="album-img" src="${cover}" style="width:200px;height:200px;margin:0 auto 1rem">
      <div class="album-title" style="font-size:1.5rem">${alb.name}</div>
      <div class="album-artist" style="font-size:1.1rem;color:#b3b3b3">${alb.artistName}</div>
    </div>
    <div id="detail-song-list" class="song-list">Cargando canciones…</div>`;
  try {
    const { documents } = await databases.listDocuments(
      DATABASE_ID, CANCIONES_COLLECTION_ID, [ Query.equal("albumId", alb.$id) ]
    );
    currentPlaylist = documents;
    if (!documents.length) return qs("detail-song-list").textContent = "No hay canciones en este álbum.";
    qs("detail-song-list").innerHTML = "<ul>" + documents.map((s,i) => `
      <li><div onclick="playSongFromPlaylist(${i})" style="flex:1">${s.title}</div><span class="play-icon" onclick="playSongFromPlaylist(${i})">▶</span></li>`
    ).join("") + "</ul>";
  } catch {
    qs("detail-song-list").textContent = "Error al cargar canciones";
  }
}
function showAlbumsGrid() { show(qs("albums")); hide(qs("album-detail")); }

/* =========================================================
 * REPRODUCTOR
 * ======================================================= */
function playSongFromPlaylist(i) { playSong(currentPlaylist[i], currentAlbum); }
function playSong(song, alb) {
  currentSong = song; currentAlbum = alb;
  const audio = qs("audio-player");
  audio.src   = storage.getFileDownload(STORAGE_BUCKET_ID, song.storageId);
  audio.play(); updatePlayers();
}
function updatePlayers() {
  updateMini(); updateFull(); updatePlayButtons();
}
function updateMini() {
  if (!currentSong) return;
  show(qs("mini-player"));
  qs("mini-player-img").src         = storage.getFilePreview(STORAGE_BUCKET_ID, currentAlbum.coverStorageId);
  qs("mini-player-title").textContent  = currentSong.title;
  qs("mini-player-artist").textContent = currentAlbum.artistName;
}
function updateFull() {
  if (!currentSong) return;
  qs("full-player-cover").src         = storage.getFilePreview(STORAGE_BUCKET_ID, currentAlbum.coverStorageId);
  qs("full-player-title").textContent  = currentSong.title;
  qs("full-player-artist").textContent = currentAlbum.artistName;
}
function updatePlayButtons() {
  const txt = isPlaying ? "⏸" : "▶";
  qs("mini-play-btn").textContent = txt;
  qs("full-play-btn").textContent = txt;
}
function togglePlay() {
  const audio = qs("audio-player");
  if (!audio.src) return;
  isPlaying ? audio.pause() : audio.play();
}
qs("audio-player").addEventListener("play",  () => { isPlaying = true;  updatePlayButtons(); });
qs("audio-player").addEventListener("pause", () => { isPlaying = false; updatePlayButtons(); });
function closeFullPlayer() { hide(qs("full-player")); }

/* =========================================================
 * PANEL DE ADMIN
 * ======================================================= */
async function renderAdminPanel() {
  const c = qs("admin-content");
  c.innerHTML = `
    <div class="admin-section">
      <h4>Gestión de Álbumes</h4>
      <form id="album-form" class="admin-form">
        <div class="form-group"><label>Nombre del Álbum:</label><input id="album-name"   type="text" required></div>
        <div class="form-group"><label>Artista:</label>            <input id="album-artist" type="text" required></div>
        <div class="form-group"><label>Portada:</label>            <input id="album-cover" type="file" accept="image/*" required></div>
        <button class="btn-primary" type="submit">Guardar Álbum</button>
      </form>
    </div>
    <div class="admin-section">
      <h4>Gestión de Canciones</h4>
      <form id="song-form" class="admin-form">
        <div class="form-group"><label>Título:</label><input id="song-title" type="text" required></div>
        <div class="form-group"><label>Artista:</label><input id="song-artist" type="text" required></div>
        <div class="form-group"><label>Álbum:</label><select id="song-album" required><option>Cargando…</option></select></div>
        <div class="form-group"><label>Archivo MP3:</label><input id="song-file" type="file" accept="audio/*" required></div>
        <button class="btn-primary" type="submit">Guardar Canción</button>
      </form>
    </div>`;
  // cargar álbumes en <select>
  try {
    const { documents } = await databases.listDocuments(DATABASE_ID, ALBUMS_COLLECTION_ID);
    qs("song-album").innerHTML = '<option value="">-- Selecciona álbum --</option>' +
      documents.map(a => `<option value="${a.$id}">${a.name}</option>`).join("");
  } catch { qs("song-album").innerHTML = "<option>Error</option>"; }

  /* Eventos formularios */
  qs("album-form").onsubmit = async e => {
    e.preventDefault();
    loading(true);
    try {
      const cover = await storage.createFile(STORAGE_BUCKET_ID, ID.unique(), qs("album-cover").files[0]);
      await databases.createDocument(DATABASE_ID, ALBUMS_COLLECTION_ID, ID.unique(), {
        name: qs("album-name").value,
        artistName: qs("album-artist").value,
        coverStorageId: cover.$id
      });
      infoModal("Álbum guardado"); e.target.reset(); await renderAdminPanel(); await loadAllData();
    } catch (err) { infoModal("Error álbum: "+err.message); }
    loading(false);
  };
  qs("song-form").onsubmit = async e => {
    e.preventDefault();
    loading(true);
    try {
      const file = await storage.createFile(STORAGE_BUCKET_ID, ID.unique(), qs("song-file").files[0]);
      await databases.createDocument(DATABASE_ID, CANCIONES_COLLECTION_ID, ID.unique(), {
        title: qs("song-title").value,
        artist: qs("song-artist").value,
        albumId: qs("song-album").value,
        storageId: file.$id
      });
      infoModal("Canción guardada"); e.target.reset();
    } catch (err) { infoModal("Error canción: "+err.message); }
    loading(false);
  };
}

/* =========================================================
 * INICIALIZACIÓN
 * ======================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  loadSavedTheme();
  await checkSession();
  loadAllData();
});
