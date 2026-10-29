import './style.css';
import './app.css';

import {
  Connect,
  Disconnect,
  GetConnectionStatus,
  ListRemote,
  ListLocal,
  GetLocalDrives,
  GetDefaultLocalPath,
  CreateRemoteDir,
  CreateLocalDir,
  DeleteRemote,
  DeleteLocal,
  RenameRemote,
  RenameLocal,
  QueueUpload,
  QueueDownload,
  GetTransferTasks,
  CancelTransfer,
  ClearFinishedTransfers,
  GetSavedSites,
  SaveSite,
  DeleteSite,
  SelectLocalFolderDialog,
  GetFileContent,
  SaveFileContent,
  GetImageBase64,
  Chmod,
  GetSettings,
  SaveSettings,
  ClearRemoteCache
} from '../wailsjs/go/main/App';

import { EventsOn } from '../wailsjs/runtime/runtime';

// ====================================================================
// STATE
// ====================================================================
const state = {
  connected: false,
  activeProtocol: 'ftp',
  host: '',
  port: 21,
  username: '',
  
  localPath: '',
  remotePath: '/',
  localDrives: [],
  
  localFiles: [],
  remoteFiles: [],
  
  selectedLocal: new Set(),
  selectedRemote: new Set(),

  syncBrowsing: false,
  filterDev: false,
  filterHidden: false,
  activeEditorFile: null,
  activeChmodItem: null,
  
  tasks: [],
  queueTab: 'queued', // 'queued' | 'completed' | 'failed'
  
  savedSites: [],
  activeSiteId: null,

  // Right-click context target
  contextTarget: null // { pane: 'local'|'remote', item: FileItem, isBlank: boolean }
};

// ====================================================================
// SVG ICON LIBRARY
// ====================================================================
const ICONS = {
  folder: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#f59e0b;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="#f59e0b" fill-opacity="0.18"/></svg>`,
  file: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#94a3b8;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
  code: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#34d399;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  image: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#f472b6;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  archive: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#a78bfa;"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>`,
  video: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#fb7185;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  audio: `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#38bdf8;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  server: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  monitor: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  drive: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>`,
  up: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  home: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  refresh: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  browse: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  uploadArrow: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  downloadArrow: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  chevronDown: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><polyline points="6 9 12 15 18 9"/></svg>`,
  search: `<svg class="svg-icon search-icon-inside" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  link: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  linkOff: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.5 16.5l-1.5 1.5a5 5 0 0 1-7.07-7.07l1.5-1.5"/></svg>`,
  terminal: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  bookmark: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  trash: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  keyboard: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="6" y1="12" x2="6.01" y2="12"/><line x1="10" y1="12" x2="10.01" y2="12"/><line x1="14" y1="12" x2="14.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`,
  pin: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:11px;height:11px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  edit: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  settings: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  sync: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`,
  brandLogo: `<svg class="svg-icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 11 15 14"/></svg>`,
  filter: `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`
};

const DEV_PATTERNS = ['node_modules', '.git', '.venv', '__pycache__', '.idea', '.vscode', '.DS_Store', 'Thumbs.db'];
const TEXT_EXTS = new Set([
  'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'py', 'go', 'php', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'rs', 'sh', 'bash', 'zsh',
  'bat', 'cmd', 'ps1', 'sql', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'env', 'log', 'gitignore',
  'dockerfile', 'makefile', 'toml'
]);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);

function isTextOrCode(item) {
  if (item.isDir) return false;
  const ext = (item.ext || '').toLowerCase();
  return TEXT_EXTS.has(ext) || item.name.startsWith('.');
}

function isImage(item) {
  if (item.isDir) return false;
  const ext = (item.ext || '').toLowerCase();
  return IMAGE_EXTS.has(ext);
}

function filterItem(item) {
  if (state.filterDev && DEV_PATTERNS.includes(item.name)) {
    return false;
  }
  if (!state.filterHidden && item.name.startsWith('.') && item.name !== '..' && item.name !== '.') {
    return false;
  }
  return true;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Toast notification helper
function showToast(title, message, type = 'info', duration = 3500) {
  const container = document.querySelector('#toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = ICONS.link;
  if (type === 'success') iconSvg = `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#10b981;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  if (type === 'error') iconSvg = `<svg class="svg-icon" viewBox="0 0 24 24" style="color:#f43f5e;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  const remove = () => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 250);
  };

  toast.addEventListener('click', remove);
  setTimeout(remove, duration);
}

function getFileIcon(item) {
  if (item.isDir) return ICONS.folder;
  const ext = (item.ext || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return ICONS.image;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return ICONS.archive;
  if (['js', 'ts', 'jsx', 'tsx', 'go', 'py', 'java', 'c', 'cpp', 'rs', 'php', 'html', 'css', 'json', 'yaml', 'xml', 'sql'].includes(ext)) return ICONS.code;
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return ICONS.audio;
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return ICONS.video;
  return ICONS.file;
}

// ====================================================================
// RENDER INITIAL HTML SHELL
// ====================================================================
function renderAppShell() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <!-- 1. Header & QuickConnect -->
    <header class="app-header">
      <div class="top-brand-bar">
        <div class="brand-title">
          <div class="brand-icon-box">${ICONS.brandLogo}</div>
          <span>FileTfer</span>
          <span class="brand-badge">FTP &bull; SFTP</span>
        </div>
        <div class="top-actions">
          <button class="btn btn-secondary btn-sm" id="btn-open-site-manager">
            ${ICONS.bookmark}
            <span>Site Yöneticisi</span>
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-sync-browsing" title="Senkronize Gezinme: Sol tarafta bir klasöre girildiğinde sağ tarafta da eşleşen klasöre otomatik geçer">
            ${ICONS.sync}
            <span>Senkron</span>
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-filter-dev" title="Geliştirici Filtresi: node_modules, .git gibi ağır klasörleri gizle/göster">
            ${ICONS.filter}
            <span>Filtre</span>
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-settings" title="Uygulama Tercihleri ve Ayarlar">
            ${ICONS.settings}
            <span>Ayarlar</span>
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-shortcuts" title="Klavye Kısayolları">
            ${ICONS.keyboard}
            <span>Kısayollar</span>
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-toggle-log-top" title="Konsolu Göster/Gizle">
            ${ICONS.terminal}
            <span>Konsol</span>
          </button>
        </div>
      </div>

      <div class="quickconnect-bar">
        <div class="custom-select-wrapper w-protocol">
          <select id="qc-proto" class="custom-select">
            <option value="sftp" selected>SFTP (SSH)</option>
            <option value="ftp">FTP (Standart)</option>
            <option value="ftps">FTPS (TLS/SSL)</option>
          </select>
          <span class="select-arrow">${ICONS.chevronDown}</span>
        </div>

        <div class="qc-field w-host">
          <span class="qc-label">Sunucu:</span>
          <input type="text" id="qc-host" class="qc-input" placeholder="ftp.ornek.com veya IP" spellcheck="false" autocomplete="off" />
        </div>

        <div class="qc-field w-port">
          <span class="qc-label">Port:</span>
          <input type="text" id="qc-port" class="qc-input" value="22" inputmode="numeric" maxlength="5" />
        </div>

        <div class="qc-field w-user">
          <span class="qc-label">Kullanıcı:</span>
          <input type="text" id="qc-user" class="qc-input" placeholder="Kullanıcı adı" spellcheck="false" autocomplete="off" />
        </div>

        <div class="qc-field w-pass">
          <span class="qc-label">Parola:</span>
          <input type="password" id="qc-pass" class="qc-input" placeholder="••••••••" />
        </div>

        <button class="btn btn-primary" id="btn-connect">
          ${ICONS.link}
          <span>Hızlı Bağlan</span>
        </button>
        <button class="btn btn-danger" id="btn-disconnect" style="display: none;">
          ${ICONS.linkOff}
          <span>Bağlantıyı Kes</span>
        </button>
      </div>
    </header>

    <!-- 2. Status & Log Console -->
    <section class="log-panel-container" id="log-panel">
      <div class="log-header">
        <div class="log-header-left">
          ${ICONS.terminal}
          <span>Durum ve Yanıt Konsolu</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-ghost btn-sm" id="btn-clear-logs">Temizle</button>
          <button class="btn btn-ghost btn-sm" id="btn-toggle-log">Gizle/Göster</button>
        </div>
      </div>
      <div class="log-terminal" id="log-terminal"></div>
    </section>

    <!-- 3. Dual-Pane File Explorer -->
    <main class="panes-wrapper">
      <!-- SOL PANEL: Yerel Site -->
      <section class="pane-container" id="local-pane">
        <div class="pane-header">
          <div class="pane-title-group">
            <span class="pane-title">${ICONS.monitor} Yerel Site</span>
            <span class="pane-badge" id="local-count-badge">0 öğe</span>
          </div>
          <div class="search-field-wrapper">
            ${ICONS.search}
            <input type="text" id="local-search" class="search-field" placeholder="Filtrele (Ctrl+F)..." />
          </div>
        </div>

        <div class="path-toolbar">
          <div class="drive-select-wrapper">
            <select id="local-drive-select" class="drive-select"></select>
            <span class="select-arrow" style="right:4px;">${ICONS.chevronDown}</span>
          </div>
          <button class="icon-btn" id="btn-local-up" title="Üst Klasör (Backspace)">${ICONS.up}</button>
          <button class="icon-btn" id="btn-local-browse" title="Klasör Seç">${ICONS.browse}</button>
          <div class="path-container-interactive">
            <div class="breadcrumb-bar" id="local-breadcrumb" title="Dizine gitmek için tıklayın"></div>
            <input type="text" id="local-path-input" class="path-input hidden" spellcheck="false" style="display:none;" />
            <button class="btn-path-mode" id="btn-local-path-mode" title="Yolu Metin Olarak Düzenle">${ICONS.edit}</button>
          </div>
          <button class="icon-btn" id="btn-local-refresh" title="Yenile (F5)">${ICONS.refresh}</button>
        </div>

        <!-- Hızlı Yol Kısayolları -->
        <div class="path-toolbar" style="padding-top:2px; padding-bottom:3px; gap:4px; background:var(--bg-surface-elevated); border-bottom:1px solid var(--border-subtle);">
          <span style="font-size:10px; color:var(--text-dim); margin-right:2px;">Konumlar:</span>
          <div class="quick-paths-wrapper" id="local-quick-paths"></div>
        </div>

        <div class="file-table-container" id="local-table-container">
          <table class="file-table">
            <thead>
              <tr>
                <th style="width: 46%;">Dosya Adı</th>
                <th style="width: 17%;">Boyut</th>
                <th style="width: 15%;">Tür</th>
                <th style="width: 22%;">Son Değiştirilme</th>
              </tr>
            </thead>
            <tbody id="local-file-list"></tbody>
          </table>
        </div>
      </section>

      <!-- ORTA: Aktarım Butonları ve Ayraç -->
      <div class="middle-transfer-bar" id="pane-splitter" title="Genişliği ayarlamak için sürükleyin (Çift tıklama: 50/50)">
        <button class="transfer-btn" id="btn-transfer-upload" title="Seçilenleri Karşıya Yükle (Sağa Aktar)">${ICONS.uploadArrow}</button>
        <button class="transfer-btn" id="btn-transfer-download" title="Seçilenleri İndir (Sola Aktar)">${ICONS.downloadArrow}</button>
      </div>

      <!-- SAĞ PANEL: Uzak Site -->
      <section class="pane-container" id="remote-pane">
        <div class="pane-header">
          <div class="pane-title-group">
            <span class="pane-title">${ICONS.server} Uzak Site</span>
            <span class="pane-badge" id="remote-count-badge">Bağlı değil</span>
          </div>
          <div class="search-field-wrapper">
            ${ICONS.search}
            <input type="text" id="remote-search" class="search-field" placeholder="Filtrele..." />
          </div>
        </div>

        <div class="path-toolbar">
          <button class="icon-btn" id="btn-remote-root" title="Kök Dizin (/)">${ICONS.home}</button>
          <button class="icon-btn" id="btn-remote-up" title="Üst Klasör">${ICONS.up}</button>
          <div class="path-container-interactive">
            <div class="breadcrumb-bar" id="remote-breadcrumb" title="Dizine gitmek için tıklayın"></div>
            <input type="text" id="remote-path-input" class="path-input hidden" placeholder="/" spellcheck="false" style="display:none;" />
            <button class="btn-path-mode" id="btn-remote-path-mode" title="Yolu Metin Olarak Düzenle">${ICONS.edit}</button>
          </div>
          <button class="icon-btn" id="btn-remote-refresh" title="Yenile (F5)">${ICONS.refresh}</button>
        </div>

        <div class="file-table-container" id="remote-table-container">
          <table class="file-table">
            <thead>
              <tr>
                <th style="width: 44%;">Dosya Adı</th>
                <th style="width: 17%;">Boyut</th>
                <th style="width: 17%;">İzinler</th>
                <th style="width: 22%;">Son Değiştirilme</th>
              </tr>
            </thead>
            <tbody id="remote-file-list"></tbody>
          </table>
        </div>
      </section>
    </main>

    <!-- Yatay Ayraç: Kuyruk Panelini Boyutlandır -->
    <div class="splitter-horizontal" id="queue-splitter" title="Yüksekliği ayarlamak için yukarı/aşağı sürükleyin (Çift tıklama: Varsayılan)"></div>

    <!-- 4. Bottom Panel: Transfer Kuyruğu -->
    <section class="queue-panel-container" id="queue-panel">
      <div class="queue-header">
        <div class="queue-tabs">
          <div class="queue-tab active" data-tab="queued">
            <span>Aktarım Kuyruğu</span>
            <span class="tab-badge" id="badge-queued">0</span>
          </div>
          <div class="queue-tab" data-tab="completed">
            <span>Başarılı Aktarımlar</span>
            <span class="tab-badge" id="badge-completed">0</span>
          </div>
          <div class="queue-tab" data-tab="failed">
            <span>Başarısız Aktarımlar</span>
            <span class="tab-badge" id="badge-failed">0</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btn-clear-queue">
            ${ICONS.trash}
            <span>Temizle</span>
          </button>
        </div>
      </div>

      <div class="queue-list" id="queue-items-container"></div>
    </section>

    <!-- 5. Alt Durum Çubuğu -->
    <footer class="status-strip">
      <div class="status-left">
        <span class="status-dot" id="status-dot"></span>
        <span id="status-text">Bağlantı yok</span>
        <span id="status-proto-info" style="color: var(--primary-light); font-weight: 500;"></span>
      </div>
      <div class="status-right">
        <span id="status-queue-info">Kuyruk: Boşta</span>
        <span>FileTfer v1.0</span>
      </div>
    </footer>
  `;
}

// ====================================================================
// LOGGING SYSTEM
// ====================================================================
function addLogLine(msg) {
  const terminal = document.querySelector('#log-terminal');
  if (!terminal) return;

  const row = document.createElement('div');
  row.className = `log-entry ${msg.type || 'info'}`;
  
  const typeLabel = (msg.type || 'info').toUpperCase();

  row.innerHTML = `
    <span class="log-time">[${msg.timestamp || ''}]</span>
    <span class="log-type">${typeLabel}:</span>
    <span class="log-text">${escapeHtml(msg.text || '')}</span>
  `;

  terminal.appendChild(row);
  if (terminal.childElementCount > 300) {
    terminal.removeChild(terminal.firstElementChild);
  }
  terminal.scrollTop = terminal.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function debounce(fn, wait = 60) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ====================================================================
// BREADCRUMB & PATH NAVIGATION
// ====================================================================
function renderBreadcrumb(type, currentPath) {
  const container = document.querySelector(type === 'local' ? '#local-breadcrumb' : '#remote-breadcrumb');
  if (!container || !currentPath) return;
  container.innerHTML = '';

  if (type === 'local') {
    const parts = currentPath.split('\\').filter(Boolean);
    let accum = '';
    parts.forEach((part, idx) => {
      if (idx === 0) {
        accum = part.includes(':') ? part + '\\' : part;
      } else {
        accum += (accum.endsWith('\\') ? '' : '\\') + part;
      }
      const target = accum;
      const span = document.createElement('span');
      span.className = 'breadcrumb-segment';
      span.textContent = part;
      span.title = target;
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        loadLocalFiles(target);
      });
      container.appendChild(span);

      if (idx < parts.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '>';
        container.appendChild(sep);
      }
    });
  } else {
    const spanRoot = document.createElement('span');
    spanRoot.className = 'breadcrumb-segment';
    spanRoot.textContent = '/';
    spanRoot.title = '/';
    spanRoot.addEventListener('click', (e) => {
      e.stopPropagation();
      loadRemoteFiles('/');
    });
    container.appendChild(spanRoot);

    const parts = currentPath.split('/').filter(Boolean);
    let accum = '';
    parts.forEach((part) => {
      accum += '/' + part;
      const target = accum;
      
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-separator';
      sep.textContent = '/';
      container.appendChild(sep);

      const span = document.createElement('span');
      span.className = 'breadcrumb-segment';
      span.textContent = part;
      span.title = target;
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        loadRemoteFiles(target);
      });
      container.appendChild(span);
    });
  }

  container.ondblclick = () => togglePathInputMode(type, true);
}

function togglePathInputMode(type, showInput) {
  const breadcrumb = document.querySelector(type === 'local' ? '#local-breadcrumb' : '#remote-breadcrumb');
  const input = document.querySelector(type === 'local' ? '#local-path-input' : '#remote-path-input');
  if (!breadcrumb || !input) return;

  if (showInput) {
    breadcrumb.style.display = 'none';
    input.classList.remove('hidden');
    input.style.display = 'block';
    input.focus();
    input.select();
  } else {
    breadcrumb.style.display = 'flex';
    input.classList.add('hidden');
    input.style.display = 'none';
  }
}

// ====================================================================
// LOCAL FILE SYSTEM NAVIGATION
// ====================================================================
async function loadLocalFiles(path) {
  try {
    const targetPath = path || state.localPath;
    const files = await ListLocal(targetPath);
    state.localFiles = files || [];
    state.localPath = targetPath;
    state.selectedLocal.clear();

    const input = document.querySelector('#local-path-input');
    if (input) input.value = state.localPath;

    renderBreadcrumb('local', state.localPath);
    renderLocalTable();
  } catch (err) {
    addLogLine({ timestamp: new Date().toLocaleTimeString(), type: 'error', text: `Yerel dizin okunamadı: ${err}` });
  }
}

async function navigateLocal(path, folderName) {
  await loadLocalFiles(path);
  if (state.syncBrowsing && state.connected && folderName) {
    const match = state.remoteFiles.find(f => f.isDir && f.name.toLowerCase() === folderName.toLowerCase());
    if (match) {
      await loadRemoteFiles(match.path);
    }
  }
}

function updateLocalSelectionVisuals() {
  const tbody = document.querySelector('#local-file-list');
  const countBadge = document.querySelector('#local-count-badge');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('.file-row:not(.parent-row)');
  rows.forEach(tr => {
    const p = tr.dataset.path;
    if (state.selectedLocal.has(p)) {
      tr.classList.add('selected');
    } else {
      tr.classList.remove('selected');
    }
  });

  if (countBadge) {
    const filter = (document.querySelector('#local-search')?.value || '').toLowerCase();
    const filtered = state.localFiles.filter(f => f.name.toLowerCase().includes(filter) && filterItem(f));
    const selectedItems = state.localFiles.filter(f => state.selectedLocal.has(f.path));
    const selectedBytes = selectedItems.reduce((acc, f) => acc + (f.size || 0), 0);
    if (state.selectedLocal.size > 0) {
      countBadge.textContent = `${state.selectedLocal.size} / ${filtered.length} (${formatBytes(selectedBytes)})`;
    } else {
      countBadge.textContent = `${filtered.length} öğe`;
    }
  }
}

function renderLocalTable() {
  const tbody = document.querySelector('#local-file-list');
  const countBadge = document.querySelector('#local-count-badge');
  const filter = (document.querySelector('#local-search')?.value || '').toLowerCase();

  if (!tbody) return;
  tbody.innerHTML = '';

  const fragment = document.createDocumentFragment();

  // Add ".." Parent Directory Row
  const parentTr = document.createElement('tr');
  parentTr.className = 'file-row parent-row';
  parentTr.innerHTML = `
    <td class="file-name-cell">
      <span class="file-icon-box">${ICONS.folder}</span>
      <span style="font-weight: 500;">.. [Üst Klasör]</span>
    </td>
    <td>&lt;DIR&gt;</td>
    <td>Klasör</td>
    <td>--</td>
  `;
  parentTr.addEventListener('dblclick', () => goLocalUp());
  fragment.appendChild(parentTr);

  const filtered = state.localFiles.filter(f => f.name.toLowerCase().includes(filter) && filterItem(f));
  const selectedItems = state.localFiles.filter(f => state.selectedLocal.has(f.path));
  const selectedBytes = selectedItems.reduce((acc, f) => acc + (f.size || 0), 0);

  if (countBadge) {
    if (state.selectedLocal.size > 0) {
      countBadge.textContent = `${state.selectedLocal.size} / ${filtered.length} (${formatBytes(selectedBytes)})`;
    } else {
      countBadge.textContent = `${filtered.length} öğe`;
    }
  }

  if (filtered.length === 0) {
    const emptyTr = document.createElement('tr');
    emptyTr.innerHTML = `<td colspan="4" style="text-align:center; padding: 24px; color: var(--text-dim);">Bu klasör boş veya filtrelendi</td>`;
    fragment.appendChild(emptyTr);
    tbody.appendChild(fragment);
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = `file-row ${state.selectedLocal.has(item.path) ? 'selected' : ''}`;
    tr.dataset.path = item.path;
    tr.setAttribute('draggable', 'true');

    tr.addEventListener('dragstart', (e) => {
      const paths = state.selectedLocal.has(item.path) ? Array.from(state.selectedLocal) : [item.path];
      e.dataTransfer.setData('application/json', JSON.stringify({ source: 'local', paths }));
      e.dataTransfer.effectAllowed = 'copyMove';
    });

    tr.innerHTML = `
      <td class="file-name-cell" title="${escapeHtml(item.name)}">
        <span class="file-icon-box">${getFileIcon(item)}</span>
        <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.name)}</span>
      </td>
      <td>${item.humanSize}</td>
      <td>${item.isDir ? 'Klasör' : (item.ext ? item.ext.toUpperCase() + ' Dosyası' : 'Dosya')}</td>
      <td>${item.modTime || ''}</td>
    `;

    // Selection
    tr.addEventListener('click', (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        state.selectedLocal.clear();
      }
      if (state.selectedLocal.has(item.path)) {
        state.selectedLocal.delete(item.path);
      } else {
        state.selectedLocal.add(item.path);
      }
      updateLocalSelectionVisuals();
    });

    // Double Click: If folder -> open; If text/code -> editor; If image -> preview; Else upload
    tr.addEventListener('dblclick', () => {
      if (item.isDir) {
        navigateLocal(item.path, item.name);
      } else if (isTextOrCode(item)) {
        openFileInEditor(item, false);
      } else if (isImage(item)) {
        openImagePreview(item, false);
      } else {
        if (!state.connected) {
          addLogLine({ timestamp: new Date().toLocaleTimeString(), type: 'error', text: 'Karşıya yüklemek için önce bir sunucuya bağlanın!' });
          return;
        }
        QueueUpload(item.path, state.remotePath, item.size);
      }
    });

    // Right Click Context Menu
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      state.selectedLocal.clear();
      state.selectedLocal.add(item.path);
      updateLocalSelectionVisuals();
      showContextMenu(e.clientX, e.clientY, { pane: 'local', item, isBlank: false });
    });

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

async function goLocalUp() {
  const cur = state.localPath;
  const parts = cur.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 1) {
    return; // Root
  }
  parts.pop();
  let upPath = parts.join('\\');
  if (parts.length === 1 && cur.includes(':')) {
    upPath += '\\';
  }
  await loadLocalFiles(upPath);
  if (state.syncBrowsing && state.connected) {
    goRemoteUp();
  }
}

// ====================================================================
// REMOTE FILE SYSTEM NAVIGATION
// ====================================================================
async function loadRemoteFiles(path) {
  if (!state.connected) return;
  try {
    const targetPath = path || state.remotePath || '/';
    const files = await ListRemote(targetPath);
    state.remoteFiles = files || [];
    state.remotePath = targetPath;
    state.selectedRemote.clear();

    const input = document.querySelector('#remote-path-input');
    if (input) input.value = state.remotePath;

    renderBreadcrumb('remote', state.remotePath);
    renderRemoteTable();
  } catch (err) {
    addLogLine({ timestamp: new Date().toLocaleTimeString(), type: 'error', text: `Uzak dizin okunamadı: ${err}` });
  }
}

async function navigateRemote(path, folderName) {
  await loadRemoteFiles(path);
  if (state.syncBrowsing && folderName) {
    const match = state.localFiles.find(f => f.isDir && f.name.toLowerCase() === folderName.toLowerCase());
    if (match) {
      await loadLocalFiles(match.path);
    }
  }
}

function updateRemoteSelectionVisuals() {
  const tbody = document.querySelector('#remote-file-list');
  const countBadge = document.querySelector('#remote-count-badge');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('.file-row:not(.parent-row)');
  rows.forEach(tr => {
    const p = tr.dataset.path;
    if (state.selectedRemote.has(p)) {
      tr.classList.add('selected');
    } else {
      tr.classList.remove('selected');
    }
  });

  if (countBadge) {
    const filter = (document.querySelector('#remote-search')?.value || '').toLowerCase();
    const filtered = state.remoteFiles.filter(f => f.name.toLowerCase().includes(filter) && filterItem(f));
    const selectedItems = state.remoteFiles.filter(f => state.selectedRemote.has(f.path));
    const selectedBytes = selectedItems.reduce((acc, f) => acc + (f.size || 0), 0);
    if (state.selectedRemote.size > 0) {
      countBadge.textContent = `${state.selectedRemote.size} / ${filtered.length} (${formatBytes(selectedBytes)})`;
    } else {
      countBadge.textContent = `${filtered.length} öğe`;
    }
  }
}

function renderRemoteTable() {
  const tbody = document.querySelector('#remote-file-list');
  const countBadge = document.querySelector('#remote-count-badge');
  const filter = (document.querySelector('#remote-search')?.value || '').toLowerCase();

  if (!tbody) return;
  tbody.innerHTML = '';

  if (!state.connected) {
    if (countBadge) countBadge.textContent = 'Bağlı değil';
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="file-empty-state">
            <div style="width: 32px; height: 32px; color: var(--text-dim); margin-bottom: 4px;">${ICONS.server}</div>
            <span style="font-weight: 500; color: var(--text-muted);">Sunucuya bağlı değilsiniz</span>
            <span style="font-size: 11px;">Yukarıdaki hızlı bağlantı çubuğundan bilgileri girip "Hızlı Bağlan"a tıklayın.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  // Parent Directory Row
  if (state.remotePath !== '/' && state.remotePath !== '') {
    const parentTr = document.createElement('tr');
    parentTr.className = 'file-row parent-row';
    parentTr.innerHTML = `
      <td class="file-name-cell">
        <span class="file-icon-box">${ICONS.folder}</span>
        <span style="font-weight: 500;">.. [Üst Klasör]</span>
      </td>
      <td>&lt;DIR&gt;</td>
      <td>drwxr-xr-x</td>
      <td>--</td>
    `;
    parentTr.addEventListener('dblclick', () => goRemoteUp());
    fragment.appendChild(parentTr);
  }

  const filtered = state.remoteFiles.filter(f => f.name.toLowerCase().includes(filter) && filterItem(f));
  const selectedItems = state.remoteFiles.filter(f => state.selectedRemote.has(f.path));
  const selectedBytes = selectedItems.reduce((acc, f) => acc + (f.size || 0), 0);

  if (countBadge) {
    if (state.selectedRemote.size > 0) {
      countBadge.textContent = `${state.selectedRemote.size} / ${filtered.length} (${formatBytes(selectedBytes)})`;
    } else {
      countBadge.textContent = `${filtered.length} öğe`;
    }
  }

  if (filtered.length === 0) {
    const emptyTr = document.createElement('tr');
    emptyTr.innerHTML = `<td colspan="4" style="text-align:center; padding: 24px; color: var(--text-dim);">Bu uzak klasör boş veya filtrelendi</td>`;
    fragment.appendChild(emptyTr);
    tbody.appendChild(fragment);
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = `file-row ${state.selectedRemote.has(item.path) ? 'selected' : ''}`;
    tr.dataset.path = item.path;
    tr.setAttribute('draggable', 'true');

    tr.addEventListener('dragstart', (e) => {
      const paths = state.selectedRemote.has(item.path) ? Array.from(state.selectedRemote) : [item.path];
      e.dataTransfer.setData('application/json', JSON.stringify({ source: 'remote', paths }));
      e.dataTransfer.effectAllowed = 'copyMove';
    });

    tr.innerHTML = `
      <td class="file-name-cell" title="${escapeHtml(item.name)}">
        <span class="file-icon-box">${getFileIcon(item)}</span>
        <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.name)}</span>
      </td>
      <td>${item.humanSize}</td>
      <td style="font-family: var(--font-mono); font-size: 11px;">${item.permissions || '-'}</td>
      <td>${item.modTime || ''}</td>
    `;

    // Selection
    tr.addEventListener('click', (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        state.selectedRemote.clear();
      }
      if (state.selectedRemote.has(item.path)) {
        state.selectedRemote.delete(item.path);
      } else {
        state.selectedRemote.add(item.path);
      }
      updateRemoteSelectionVisuals();
    });

    // Double Click: If folder -> enter; If text/code -> editor; If image -> preview; Else download
    tr.addEventListener('dblclick', () => {
      if (item.isDir) {
        navigateRemote(item.path, item.name);
      } else if (isTextOrCode(item)) {
        openFileInEditor(item, true);
      } else if (isImage(item)) {
        openImagePreview(item, true);
      } else {
        QueueDownload(item.path, state.localPath, item.size);
      }
    });

    // Right Click Context Menu
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      state.selectedRemote.clear();
      state.selectedRemote.add(item.path);
      updateRemoteSelectionVisuals();
      showContextMenu(e.clientX, e.clientY, { pane: 'remote', item, isBlank: false });
    });

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

async function goRemoteUp() {
  const cur = state.remotePath;
  const parts = cur.split('/').filter(Boolean);
  if (parts.length === 0) return;
  parts.pop();
  const upPath = '/' + parts.join('/');
  await loadRemoteFiles(upPath);
}

// ====================================================================
// TRANSFER QUEUE RENDERING
// ====================================================================
function renderQueue() {
  const container = document.querySelector('#queue-items-container');
  const badgeQueued = document.querySelector('#badge-queued');
  const badgeCompleted = document.querySelector('#badge-completed');
  const badgeFailed = document.querySelector('#badge-failed');
  const statusQueueInfo = document.querySelector('#status-queue-info');

  if (!container) return;

  const queuedOrActive = state.tasks.filter(t => t.status === 'queued' || t.status === 'active');
  const completed = state.tasks.filter(t => t.status === 'completed');
  const failed = state.tasks.filter(t => t.status === 'failed' || t.status === 'cancelled');

  if (badgeQueued) badgeQueued.textContent = queuedOrActive.length;
  if (badgeCompleted) badgeCompleted.textContent = completed.length;
  if (badgeFailed) badgeFailed.textContent = failed.length;

  if (statusQueueInfo) {
    if (queuedOrActive.length > 0) {
      statusQueueInfo.textContent = `Aktarım sürüyor: ${queuedOrActive.length} dosya kuyrukta`;
      statusQueueInfo.style.color = 'var(--primary-light)';
    } else {
      statusQueueInfo.textContent = 'Kuyruk: Boşta';
      statusQueueInfo.style.color = 'var(--text-muted)';
    }
  }

  let list = [];
  if (state.queueTab === 'queued') list = queuedOrActive;
  else if (state.queueTab === 'completed') list = completed;
  else if (state.queueTab === 'failed') list = failed;

  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-dim); font-size: 11px;">Bu sekmede gösterilecek aktarım yok.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach(t => {
    const itemEl = document.createElement('div');
    itemEl.className = 'queue-item';

    const dirClass = t.direction === 'upload' ? 'upload' : 'download';
    const dirText = t.direction === 'upload' ? 'YÜKLE' : 'İNDİR';

    itemEl.innerHTML = `
      <span class="queue-direction ${dirClass}">${dirText}</span>
      <div class="queue-info">
        <div class="queue-name-row">
          <span>${escapeHtml(t.name)}</span>
          <span style="font-size: 10px; color: var(--text-dim);">${t.speed || ''} (${t.percentage.toFixed(1)}%)</span>
        </div>
        <div class="queue-path">${t.direction === 'upload' ? `${escapeHtml(t.localPath)} &rarr; ${escapeHtml(t.remotePath)}` : `${escapeHtml(t.remotePath)} &rarr; ${escapeHtml(t.localPath)}`}</div>
        <div class="queue-progress-bar-bg">
          <div class="queue-progress-fill ${t.status}" style="width: ${t.percentage}%;"></div>
        </div>
      </div>
      <div class="queue-stats">
        <span>${t.status === 'failed' ? `<span style="color:#f87171;">${t.errorMsg || 'Hata'}</span>` : (t.status === 'completed' ? '<span style="color:#10b981;font-weight:600;">100%</span>' : `${t.percentage.toFixed(0)}%`)}</span>
        ${t.status === 'active' || t.status === 'queued' ? `<button class="btn btn-ghost btn-sm" onclick="window.cancelTask('${t.id}')">İptal</button>` : ''}
      </div>
    `;

    fragment.appendChild(itemEl);
  });

  container.appendChild(fragment);
}

window.cancelTask = function(id) {
  CancelTransfer(id);
};

// ====================================================================
// CONTEXT MENU LOGIC
// ====================================================================
function showContextMenu(x, y, target) {
  state.contextTarget = target;
  const menu = document.querySelector('#context-menu');
  if (!menu) return;

  const transferItem = document.querySelector('#ctx-transfer');
  const transferText = document.querySelector('#ctx-transfer-text');
  const transferIcon = document.querySelector('#ctx-transfer-icon');
  const editItem = document.querySelector('#ctx-edit');
  const chmodItem = document.querySelector('#ctx-chmod');

  if (target.pane === 'local') {
    transferText.textContent = 'Karşıya Yükle (Sağa Aktar)';
    transferIcon.innerHTML = ICONS.uploadArrow;
    if (chmodItem) chmodItem.style.display = 'none';
  } else {
    transferText.textContent = 'İndir (Sola Aktar)';
    transferIcon.innerHTML = ICONS.downloadArrow;
    if (chmodItem) chmodItem.style.display = 'flex';
  }

  if (editItem) {
    if (target.item && !target.item.isDir && (isTextOrCode(target.item) || isImage(target.item))) {
      editItem.style.display = 'flex';
    } else {
      editItem.style.display = 'none';
    }
  }

  menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
  menu.classList.remove('hidden');
}

function hideContextMenu() {
  const menu = document.querySelector('#context-menu');
  if (menu) menu.classList.add('hidden');
}

// ====================================================================
// INLINE CODE / TEXT EDITOR LOGIC
// ====================================================================
async function openFileInEditor(item, isRemote) {
  try {
    showToast('Açılıyor', `${item.name} içeriği okunuyor...`, 'info', 1800);
    const content = await GetFileContent(item.path, isRemote);

    state.activeEditorFile = {
      path: item.path,
      name: item.name,
      isRemote: isRemote,
      originalContent: content
    };

    const modal = document.querySelector('#editor-modal');
    const filenameEl = document.querySelector('#editor-filename');
    const pathBadge = document.querySelector('#editor-path-badge');
    const textarea = document.querySelector('#editor-textarea');
    const modifiedTag = document.querySelector('#editor-modified-tag');
    const statsEl = document.querySelector('#editor-stats');

    filenameEl.textContent = item.name;
    pathBadge.textContent = `${isRemote ? 'Uzak Sunucu' : 'Yerel Disk'}: ${item.path}`;
    textarea.value = content;
    modifiedTag.classList.add('hidden');

    const updateStats = () => {
      const lines = textarea.value.split('\n').length;
      const chars = textarea.value.length;
      statsEl.textContent = `Satır: ${lines} | Karakter: ${chars}`;
      if (textarea.value !== state.activeEditorFile.originalContent) {
        modifiedTag.classList.remove('hidden');
      } else {
        modifiedTag.classList.add('hidden');
      }
    };

    textarea.oninput = updateStats;
    updateStats();

    modal.classList.remove('hidden');
    textarea.focus();
  } catch (err) {
    showToast('Dosya Açılamadı', String(err), 'error', 5000);
  }
}

async function saveEditorContent() {
  if (!state.activeEditorFile) return;
  const textarea = document.querySelector('#editor-textarea');
  const modifiedTag = document.querySelector('#editor-modified-tag');
  const saveBtn = document.querySelector('#btn-editor-save');

  const newContent = textarea.value;
  saveBtn.disabled = true;

  try {
    await SaveFileContent(state.activeEditorFile.path, state.activeEditorFile.isRemote, newContent);
    state.activeEditorFile.originalContent = newContent;
    modifiedTag.classList.add('hidden');
    showToast('Kaydedildi', `${state.activeEditorFile.name} başarıyla güncellendi.`, 'success', 3000);
  } catch (err) {
    showToast('Kaydetme Hatası', String(err), 'error', 5000);
  } finally {
    saveBtn.disabled = false;
  }
}

function closeEditorModal() {
  const modal = document.querySelector('#editor-modal');
  if (modal) modal.classList.add('hidden');
  state.activeEditorFile = null;
}

// ====================================================================
// IMAGE PREVIEW LIGHTBOX LOGIC
// ====================================================================
async function openImagePreview(item, isRemote) {
  try {
    showToast('Önizleme', `${item.name} yükleniyor...`, 'info', 1800);
    const dataUri = await GetImageBase64(item.path, isRemote);

    const modal = document.querySelector('#image-preview-modal');
    const titleEl = document.querySelector('#image-preview-title');
    const imgEl = document.querySelector('#image-preview-img');
    const infoEl = document.querySelector('#image-preview-info');

    titleEl.textContent = `${item.name} (${formatBytes(item.size)})`;
    imgEl.src = dataUri;

    imgEl.onload = () => {
      infoEl.textContent = `${imgEl.naturalWidth} x ${imgEl.naturalHeight} px | ${formatBytes(item.size)} | ${item.path}`;
    };

    modal.classList.remove('hidden');
  } catch (err) {
    showToast('Resim Açılamadı', String(err), 'error', 5000);
  }
}

function closeImageModal() {
  const modal = document.querySelector('#image-preview-modal');
  if (modal) modal.classList.add('hidden');
}

// ====================================================================
// CHMOD PERMISSIONS LOGIC
// ====================================================================
function openChmodModal(item) {
  state.activeChmodItem = item;
  const modal = document.querySelector('#chmod-modal');
  const pathEl = document.querySelector('#chmod-file-path');
  const octalInput = document.querySelector('#chmod-octal-input');
  const recursiveCheck = document.querySelector('#chmod-recursive');

  pathEl.textContent = item.path;
  recursiveCheck.checked = false;

  const initialOctal = item.isDir ? '0755' : '0644';
  octalInput.value = initialOctal;
  syncCheckboxesFromOctal(initialOctal);

  modal.classList.remove('hidden');
}

function closeChmodModal() {
  const modal = document.querySelector('#chmod-modal');
  if (modal) modal.classList.add('hidden');
  state.activeChmodItem = null;
}

function syncCheckboxesFromOctal(octalStr) {
  const clean = (octalStr || '').replace(/^0+/, '').padStart(3, '0');
  const owner = parseInt(clean[0], 8) || 0;
  const group = parseInt(clean[1], 8) || 0;
  const pub = parseInt(clean[2], 8) || 0;

  const setCheck = (id, val) => {
    const el = document.querySelector(id);
    if (el) el.checked = val;
  };

  setCheck('#chmod-owner-r', (owner & 4) !== 0);
  setCheck('#chmod-owner-w', (owner & 2) !== 0);
  setCheck('#chmod-owner-x', (owner & 1) !== 0);

  setCheck('#chmod-group-r', (group & 4) !== 0);
  setCheck('#chmod-group-w', (group & 2) !== 0);
  setCheck('#chmod-group-x', (group & 1) !== 0);

  setCheck('#chmod-public-r', (pub & 4) !== 0);
  setCheck('#chmod-public-w', (pub & 2) !== 0);
  setCheck('#chmod-public-x', (pub & 1) !== 0);
}

function syncOctalFromCheckboxes() {
  const isChecked = id => !!document.querySelector(id)?.checked;
  let owner = 0;
  if (isChecked('#chmod-owner-r')) owner += 4;
  if (isChecked('#chmod-owner-w')) owner += 2;
  if (isChecked('#chmod-owner-x')) owner += 1;

  let group = 0;
  if (isChecked('#chmod-group-r')) group += 4;
  if (isChecked('#chmod-group-w')) group += 2;
  if (isChecked('#chmod-group-x')) group += 1;

  let pub = 0;
  if (isChecked('#chmod-public-r')) pub += 4;
  if (isChecked('#chmod-public-w')) pub += 2;
  if (isChecked('#chmod-public-x')) pub += 1;

  const octal = `0${owner}${group}${pub}`;
  const input = document.querySelector('#chmod-octal-input');
  if (input) input.value = octal;
}

async function applyChmodFromModal() {
  if (!state.activeChmodItem) return;
  const octal = document.querySelector('#chmod-octal-input').value.trim() || '0755';
  const recursive = !!document.querySelector('#chmod-recursive')?.checked;

  try {
    await Chmod(state.activeChmodItem.path, octal, recursive);
    showToast('İzinler Güncellendi', `${state.activeChmodItem.name} (${octal})`, 'success', 3000);
    closeChmodModal();
    loadRemoteFiles();
  } catch (err) {
    showToast('CHMOD Hatası', String(err), 'error', 5000);
  }
}

// ====================================================================
// SETTINGS / PREFERENCES MODAL LOGIC
// ====================================================================
async function openSettingsModal() {
  const modal = document.querySelector('#settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  try {
    const settings = await GetSettings();
    if (settings) {
      const workers = settings.maxWorkers || 4;
      const timeout = settings.defaultTimeoutSec || 15;
      const filterDev = !!settings.filterDevFiles;
      const filterHidden = !!settings.filterHiddenFiles;

      const slider = document.querySelector('#setting-workers-slider');
      const workersVal = document.querySelector('#setting-workers-val');
      const timeoutInput = document.querySelector('#setting-timeout');
      const devCheck = document.querySelector('#setting-filter-dev');
      const hiddenCheck = document.querySelector('#setting-filter-hidden');

      if (slider) slider.value = workers;
      if (workersVal) workersVal.textContent = workers;
      if (timeoutInput) timeoutInput.value = timeout;
      if (devCheck) devCheck.checked = filterDev;
      if (hiddenCheck) hiddenCheck.checked = filterHidden;
    }
  } catch (err) {
    console.warn('Ayarlar backendden okunamadı:', err);
  }
}

function closeSettingsModal() {
  const modal = document.querySelector('#settings-modal');
  if (modal) modal.classList.add('hidden');
}

async function saveSettingsFromModal() {
  const workers = parseInt(document.querySelector('#setting-workers-slider').value, 10) || 3;
  const timeout = parseInt(document.querySelector('#setting-timeout').value, 10) || 15;
  const filterDev = !!document.querySelector('#setting-filter-dev')?.checked;
  const filterHidden = !!document.querySelector('#setting-filter-hidden')?.checked;

  const newSettings = {
    maxWorkers: workers,
    defaultTimeoutSec: timeout,
    filterDevFiles: filterDev,
    filterHiddenFiles: filterHidden,
    devFilterPatterns: DEV_PATTERNS,
    syncBrowsing: state.syncBrowsing
  };

  try {
    await SaveSettings(newSettings);
    state.filterDev = filterDev;
    state.filterHidden = filterHidden;

    const filterBtn = document.querySelector('#btn-filter-dev');
    if (filterBtn) {
      if (state.filterDev) filterBtn.classList.add('btn-filter-active');
      else filterBtn.classList.remove('btn-filter-active');
    }

    renderLocalTable();
    if (state.connected) renderRemoteTable();

    closeSettingsModal();
    showToast('Ayarlar Kaydedildi', 'Uygulama tercihleri başarıyla güncellendi.', 'success', 3000);
  } catch (err) {
    showToast('Ayarlar Kaydedilemedi', String(err), 'error', 5000);
  }
}

// ====================================================================
// MODAL DIALOGS (Prompt & Confirmation)
// ====================================================================
function showPromptModal(title, message, defaultValue, onConfirm) {
  const modal = document.querySelector('#prompt-modal');
  const titleEl = document.querySelector('#prompt-title');
  const msgEl = document.querySelector('#prompt-message');
  const inputEl = document.querySelector('#prompt-input');
  const confirmBtn = document.querySelector('#prompt-confirm-btn');
  const cancelBtn = document.querySelector('#prompt-cancel-btn');
  const closeBtn = document.querySelector('#close-prompt-modal');

  titleEl.textContent = title;
  msgEl.textContent = message;
  inputEl.value = defaultValue || '';
  modal.classList.remove('hidden');
  inputEl.focus();

  const handleConfirm = () => {
    modal.classList.add('hidden');
    onConfirm(inputEl.value);
    cleanup();
  };

  const handleCancel = () => {
    modal.classList.add('hidden');
    cleanup();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  function cleanup() {
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    closeBtn.removeEventListener('click', handleCancel);
    inputEl.removeEventListener('keydown', handleKey);
  }

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  inputEl.addEventListener('keydown', handleKey);
}

// ====================================================================
// SITE MANAGER
// ====================================================================
async function openSiteManager() {
  const modal = document.querySelector('#site-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  try {
    state.savedSites = await GetSavedSites() || [];
    renderSavedSitesList();
  } catch (err) {
    console.error('Siteler yüklenemedi:', err);
  }
}

function renderSavedSitesList() {
  const listEl = document.querySelector('#saved-sites-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (state.savedSites.length === 0) {
    listEl.innerHTML = `<li style="padding: 12px; color: var(--text-dim); font-size: 11px;">Kayıtlı sunucu yok. Sağdan bilgileri girerek ekleyin.</li>`;
    return;
  }

  state.savedSites.forEach(site => {
    const li = document.createElement('li');
    li.className = `site-list-item ${state.activeSiteId === site.id ? 'selected' : ''}`;
    li.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <span style="color:var(--text-dim); display:flex;">${ICONS.server}</span>
        <div style="overflow:hidden; text-overflow:ellipsis;">
          <div style="font-weight:600; color:var(--text-main);">${escapeHtml(site.name)}</div>
          <div style="font-size:10px; color:var(--text-dim); font-family:var(--font-mono);">${site.protocol.toUpperCase()}://${site.host}:${site.port}</div>
        </div>
      </div>
      <span class="brand-badge" style="font-size:9px; text-transform:uppercase;">${site.protocol}</span>
    `;

    li.addEventListener('click', () => {
      state.activeSiteId = site.id;
      fillSiteForm(site);
      renderSavedSitesList();
    });

    listEl.appendChild(li);
  });
}

function fillSiteForm(site) {
  document.querySelector('#site-id').value = site ? site.id : '';
  document.querySelector('#site-name').value = site ? site.name : '';
  document.querySelector('#site-protocol').value = site ? site.protocol : 'sftp';
  document.querySelector('#site-host').value = site ? site.host : '';
  document.querySelector('#site-port').value = site ? site.port : 22;
  document.querySelector('#site-user').value = site ? site.user || site.username : '';
  document.querySelector('#site-pass').value = site ? site.pass || site.password : '';
  
  const delBtn = document.querySelector('#btn-delete-site');
  if (delBtn) delBtn.style.display = site ? 'inline-flex' : 'none';
}

// ====================================================================
// CONNECTION HANDLERS
// ====================================================================
async function handleConnect(config) {
  const connectBtn = document.querySelector('#btn-connect');
  const disconnectBtn = document.querySelector('#btn-disconnect');
  const statusDot = document.querySelector('#status-dot');
  const statusText = document.querySelector('#status-text');
  const statusProto = document.querySelector('#status-proto-info');

  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.innerHTML = `<span>Bağlanılıyor...</span>`;
  }

  try {
    await Connect(config);

    state.connected = true;
    state.activeProtocol = config.protocol;
    state.host = config.host;
    state.username = config.username;

    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
    if (statusDot) statusDot.className = 'status-dot connected';
    if (statusText) statusText.textContent = `${config.username || 'user'}@${config.host}:${config.port}`;
    if (statusProto) statusProto.textContent = `[${config.protocol.toUpperCase()}]`;

    // Load remote root directory
    const status = await GetConnectionStatus();
    loadRemoteFiles(status.currentDir || '/');

    showToast('Bağlantı Başarılı', `${config.host} sunucusuna bağlanıldı.`, 'success', 3500);

  } catch (err) {
    const errMsg = String(err).replace(/^Error:\s*/, '');
    addLogLine({ timestamp: new Date().toLocaleTimeString(), type: 'error', text: `Bağlantı hatası: ${errMsg}` });
    state.connected = false;
    if (statusDot) statusDot.className = 'status-dot';
    if (statusText) statusText.textContent = 'Bağlantı başarısız';
    showToast('Bağlantı Başarısız', errMsg, 'error', 7000);
  } finally {
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.innerHTML = `${ICONS.link} <span>Hızlı Bağlan</span>`;
    }
  }
}

async function handleDisconnect() {
  await Disconnect();
  state.connected = false;
  state.remoteFiles = [];
  state.selectedRemote.clear();

  const connectBtn = document.querySelector('#btn-connect');
  const disconnectBtn = document.querySelector('#btn-disconnect');
  const statusDot = document.querySelector('#status-dot');
  const statusText = document.querySelector('#status-text');
  const statusProto = document.querySelector('#status-proto-info');

  if (connectBtn) {
    connectBtn.style.display = 'inline-flex';
    connectBtn.innerHTML = `${ICONS.link} <span>Hızlı Bağlan</span>`;
  }
  if (disconnectBtn) disconnectBtn.style.display = 'none';
  if (statusDot) statusDot.className = 'status-dot';
  if (statusText) statusText.textContent = 'Bağlantı kesildi';
  if (statusProto) statusProto.textContent = '';

  renderRemoteTable();
}

// ====================================================================
// PANEL SPLITTERS SYSTEM
// ====================================================================
try {
  localStorage.removeItem('filetfer_ui_zoom');
  document.body.style.zoom = '';
} catch (_) {}

function initSplitters() {
  const panesWrapper = document.querySelector('.panes-wrapper');
  const localPane = document.querySelector('#local-pane');
  const remotePane = document.querySelector('#remote-pane');
  const paneSplitter = document.querySelector('#pane-splitter');
  
  const queueSplitter = document.querySelector('#queue-splitter');
  const queuePanel = document.querySelector('#queue-panel');

  // Restore saved pane ratio
  const savedRatio = parseFloat(localStorage.getItem('filetfer_pane_ratio'));
  if (!isNaN(savedRatio) && savedRatio >= 0.15 && savedRatio <= 0.85 && localPane && remotePane) {
    localPane.style.flex = `${savedRatio * 100} 1 0%`;
    remotePane.style.flex = `${(1 - savedRatio) * 100} 1 0%`;
  }

  // Vertical pane splitter dragging
  if (paneSplitter && panesWrapper && localPane && remotePane) {
    let isDraggingPane = false;

    paneSplitter.addEventListener('mousedown', (e) => {
      if (e.target.closest('.transfer-btn')) return;
      isDraggingPane = true;
      paneSplitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingPane) return;
      const rect = panesWrapper.getBoundingClientRect();
      const splitterWidth = paneSplitter.offsetWidth;
      const usableWidth = rect.width - splitterWidth;
      if (usableWidth <= 0) return;

      let ratio = (e.clientX - rect.left - (splitterWidth / 2)) / usableWidth;
      ratio = Math.max(0.15, Math.min(0.85, ratio));
      localPane.style.flex = `${ratio * 100} 1 0%`;
      remotePane.style.flex = `${(1 - ratio) * 100} 1 0%`;
      localStorage.setItem('filetfer_pane_ratio', ratio.toString());
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingPane) {
        isDraggingPane = false;
        paneSplitter.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    paneSplitter.addEventListener('dblclick', (e) => {
      if (e.target.closest('.transfer-btn')) return;
      localPane.style.flex = '1 1 0%';
      remotePane.style.flex = '1 1 0%';
      localStorage.removeItem('filetfer_pane_ratio');
      showToast('Panel Sıfırlandı', 'Yerel ve Uzak paneller %50-%50 eşitlendi.', 'info');
    });
  }

  // Restore saved queue height
  const savedQueueH = parseInt(localStorage.getItem('filetfer_queue_height'), 10);
  if (!isNaN(savedQueueH) && savedQueueH >= 32 && savedQueueH <= 650 && queuePanel) {
    queuePanel.style.height = `${savedQueueH}px`;
  }

  // Horizontal queue splitter dragging
  if (queueSplitter && queuePanel) {
    let isDraggingQueue = false;
    let startY = 0;
    let startH = 0;

    queueSplitter.addEventListener('mousedown', (e) => {
      isDraggingQueue = true;
      startY = e.clientY;
      startH = queuePanel.offsetHeight;
      queueSplitter.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingQueue) return;
      const dy = startY - e.clientY; // moving mouse up increases height
      let newH = startH + dy;
      const maxH = Math.min(window.innerHeight * 0.75, 600);
      newH = Math.max(32, Math.min(maxH, newH));
      queuePanel.style.height = `${newH}px`;
      localStorage.setItem('filetfer_queue_height', newH.toString());
    });

    window.addEventListener('mouseup', () => {
      if (isDraggingQueue) {
        isDraggingQueue = false;
        queueSplitter.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    queueSplitter.addEventListener('dblclick', () => {
      queuePanel.style.height = '140px';
      localStorage.removeItem('filetfer_queue_height');
      showToast('Kuyruk Sıfırlandı', 'Kuyruk paneli varsayılan yüksekliğe alındı.', 'info');
    });
  }
}

// ====================================================================
// EVENT LISTENERS INITIALIZATION
// ====================================================================
function setupEventListeners() {
  initSplitters();

  // Protocol dropdown port autoselect
  const protoSelect = document.querySelector('#qc-proto');
  const portInput = document.querySelector('#qc-port');
  protoSelect.addEventListener('change', () => {
    if (protoSelect.value === 'sftp') {
      portInput.value = '22';
    } else {
      portInput.value = '21';
    }
  });

  // QuickConnect Click
  document.querySelector('#btn-connect').addEventListener('click', () => {
    const proto = document.querySelector('#qc-proto').value;
    const host = document.querySelector('#qc-host').value.trim();
    const port = parseInt(document.querySelector('#qc-port').value, 10) || (proto === 'sftp' ? 22 : 21);
    const user = document.querySelector('#qc-user').value.trim();
    const pass = document.querySelector('#qc-pass').value;

    if (!host) {
      alert('Lütfen bağlanılacak bir sunucu adresi veya IP girin.');
      return;
    }

    handleConnect({
      protocol: proto,
      host: host,
      port: port,
      username: user,
      password: pass,
      timeout: 15
    });
  });

  // Disconnect Click
  document.querySelector('#btn-disconnect').addEventListener('click', handleDisconnect);

  // Local Toolbar
  document.querySelector('#btn-local-up').addEventListener('click', goLocalUp);
  document.querySelector('#btn-local-refresh').addEventListener('click', () => loadLocalFiles());
  document.querySelector('#local-path-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadLocalFiles(e.target.value);
  });
  document.querySelector('#local-search').addEventListener('input', debounce(renderLocalTable, 60));

  document.querySelector('#btn-local-browse').addEventListener('click', async () => {
    const selected = await SelectLocalFolderDialog();
    if (selected) loadLocalFiles(selected);
  });

  // Local Drive Change
  const driveSelect = document.querySelector('#local-drive-select');
  driveSelect.addEventListener('change', (e) => {
    loadLocalFiles(e.target.value);
  });

  // Remote Toolbar
  document.querySelector('#btn-remote-root').addEventListener('click', () => loadRemoteFiles('/'));
  document.querySelector('#btn-remote-up').addEventListener('click', goRemoteUp);
  document.querySelector('#btn-remote-refresh').addEventListener('click', async () => {
    try {
      if (typeof ClearRemoteCache === 'function') await ClearRemoteCache();
    } catch (_) {}
    loadRemoteFiles();
  });
  document.querySelector('#remote-path-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadRemoteFiles(e.target.value);
  });
  document.querySelector('#remote-search').addEventListener('input', debounce(renderRemoteTable, 60));

  // Middle Transfer Buttons
  document.querySelector('#btn-transfer-upload').addEventListener('click', () => {
    if (!state.connected) {
      alert('Lütfen önce bir uzak sunucuya bağlanın.');
      return;
    }
    if (state.selectedLocal.size === 0) {
      alert('Lütfen sol panelden yüklenecek dosyaları seçin.');
      return;
    }
    state.selectedLocal.forEach(localPath => {
      const item = state.localFiles.find(f => f.path === localPath);
      if (item && !item.isDir) {
        QueueUpload(localPath, state.remotePath, item.size);
      }
    });
  });

  document.querySelector('#btn-transfer-download').addEventListener('click', () => {
    if (!state.connected) {
      alert('Lütfen önce bir uzak sunucuya bağlanın.');
      return;
    }
    if (state.selectedRemote.size === 0) {
      alert('Lütfen sağ panelden indirilecek dosyaları seçin.');
      return;
    }
    state.selectedRemote.forEach(remotePath => {
      const item = state.remoteFiles.find(f => f.path === remotePath);
      if (item && !item.isDir) {
        QueueDownload(remotePath, state.localPath, item.size);
      }
    });
  });

  // Queue Tabs
  document.querySelectorAll('.queue-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.queue-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.queueTab = tab.dataset.tab;
      renderQueue();
    });
  });

  document.querySelector('#btn-clear-queue').addEventListener('click', () => {
    ClearFinishedTransfers();
  });

  // Log Panel buttons
  document.querySelector('#btn-clear-logs').addEventListener('click', () => {
    const terminal = document.querySelector('#log-terminal');
    if (terminal) terminal.innerHTML = '';
  });

  const toggleLogBtn = document.querySelector('#btn-toggle-log');
  const toggleLogBtnTop = document.querySelector('#btn-toggle-log-top');
  const logPanel = document.querySelector('#log-panel');
  const handleToggleLog = () => logPanel.classList.toggle('collapsed');
  if (toggleLogBtn) toggleLogBtn.addEventListener('click', handleToggleLog);
  if (toggleLogBtnTop) toggleLogBtnTop.addEventListener('click', handleToggleLog);

  // Close context menu on outside click
  window.addEventListener('click', hideContextMenu);

  // Context Menu Actions
  document.querySelector('#ctx-transfer').addEventListener('click', () => {
    if (!state.contextTarget || !state.contextTarget.item) return;
    const { pane, item } = state.contextTarget;
    if (pane === 'local') {
      if (!state.connected) return alert('Sunucuya bağlı değilsiniz.');
      QueueUpload(item.path, state.remotePath, item.size);
    } else {
      QueueDownload(item.path, state.localPath, item.size);
    }
  });

  document.querySelector('#ctx-queue').addEventListener('click', () => {
    if (!state.contextTarget || !state.contextTarget.item) return;
    const { pane, item } = state.contextTarget;
    if (pane === 'local') {
      QueueUpload(item.path, state.remotePath, item.size);
    } else {
      QueueDownload(item.path, state.localPath, item.size);
    }
  });

  document.querySelector('#ctx-new-folder').addEventListener('click', () => {
    const pane = state.contextTarget ? state.contextTarget.pane : 'local';
    showPromptModal('Yeni Klasör Oluştur', 'Klasör adını girin:', 'Yeni Klasor', async (name) => {
      if (!name) return;
      if (pane === 'local') {
        const full = state.localPath + '\\' + name;
        await CreateLocalDir(full);
        loadLocalFiles();
      } else {
        const full = (state.remotePath === '/' ? '' : state.remotePath) + '/' + name;
        await CreateRemoteDir(full);
        loadRemoteFiles();
      }
    });
  });

  document.querySelector('#ctx-rename').addEventListener('click', () => {
    if (!state.contextTarget || !state.contextTarget.item) return;
    const { pane, item } = state.contextTarget;
    showPromptModal('Yeniden Adlandır', 'Yeni adı girin:', item.name, async (newName) => {
      if (!newName || newName === item.name) return;
      if (pane === 'local') {
        const dir = state.localPath;
        await RenameLocal(item.path, dir + '\\' + newName);
        loadLocalFiles();
      } else {
        const dir = state.remotePath;
        const target = (dir === '/' ? '' : dir) + '/' + newName;
        await RenameRemote(item.path, target);
        loadRemoteFiles();
      }
    });
  });

  document.querySelector('#ctx-delete').addEventListener('click', () => {
    if (!state.contextTarget || !state.contextTarget.item) return;
    const { pane, item } = state.contextTarget;
    if (confirm(`"${item.name}" öğesini kalıcı olarak silmek istediğinize emin misiniz?`)) {
      if (pane === 'local') {
        DeleteLocal(item.path, item.isDir).then(() => loadLocalFiles());
      } else {
        DeleteRemote(item.path, item.isDir).then(() => loadRemoteFiles());
      }
    }
  });

  document.querySelector('#ctx-refresh').addEventListener('click', () => {
    if (state.contextTarget && state.contextTarget.pane === 'remote') {
      loadRemoteFiles();
    } else {
      loadLocalFiles();
    }
  });

  // Site Manager Events
  document.querySelector('#btn-open-site-manager').addEventListener('click', openSiteManager);
  document.querySelector('#close-site-modal').addEventListener('click', () => {
    document.querySelector('#site-modal').classList.add('hidden');
  });

  document.querySelector('#btn-add-new-site').addEventListener('click', () => {
    state.activeSiteId = null;
    fillSiteForm(null);
    document.querySelector('#site-name').focus();
  });

  document.querySelector('#site-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.querySelector('#site-id').value || 'site_' + Date.now();
    const site = {
      id: id,
      name: document.querySelector('#site-name').value,
      protocol: document.querySelector('#site-protocol').value,
      host: document.querySelector('#site-host').value,
      port: parseInt(document.querySelector('#site-port').value, 10) || 22,
      username: document.querySelector('#site-user').value,
      password: document.querySelector('#site-pass').value,
    };

    await SaveSite(site);
    state.activeSiteId = id;
    state.savedSites = await GetSavedSites();
    renderSavedSitesList();
    addLogLine({ timestamp: new Date().toLocaleTimeString(), type: 'success', text: `Site kaydedildi: ${site.name}` });
  });

  document.querySelector('#btn-delete-site').addEventListener('click', async () => {
    const id = document.querySelector('#site-id').value;
    if (id && confirm('Bu site profilini silmek istediğinize emin misiniz?')) {
      await DeleteSite(id);
      state.activeSiteId = null;
      fillSiteForm(null);
      state.savedSites = await GetSavedSites();
      renderSavedSitesList();
    }
  });

  document.querySelector('#btn-connect-saved-site').addEventListener('click', async () => {
    const site = {
      protocol: document.querySelector('#site-protocol').value,
      host: document.querySelector('#site-host').value,
      port: parseInt(document.querySelector('#site-port').value, 10) || 22,
      username: document.querySelector('#site-user').value,
      password: document.querySelector('#site-pass').value,
    };

    if (!site.host) {
      alert('Lütfen sunucu adresini doldurun.');
      return;
    }

    document.querySelector('#site-modal').classList.add('hidden');

    // Fill top bar
    document.querySelector('#qc-proto').value = site.protocol;
    document.querySelector('#qc-host').value = site.host;
    document.querySelector('#qc-port').value = site.port;
    document.querySelector('#qc-user').value = site.username;
    document.querySelector('#qc-pass').value = site.password;

    handleConnect(site);
  });

  // Sync Browsing Button
  const syncBtn = document.querySelector('#btn-sync-browsing');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      state.syncBrowsing = !state.syncBrowsing;
      if (state.syncBrowsing) {
        syncBtn.classList.add('btn-toggle-active');
        showToast('Senkron Gezinme Açık', 'Klasör geçişleri her iki panelde de eşzamanlı yapılacak.', 'info', 3000);
      } else {
        syncBtn.classList.remove('btn-toggle-active');
        showToast('Senkron Gezinme Kapalı', 'Klasörler bağımsız gezilecek.', 'info', 2000);
      }
    });
  }

  // Dev Filter Button
  const filterBtn = document.querySelector('#btn-filter-dev');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      state.filterDev = !state.filterDev;
      if (state.filterDev) {
        filterBtn.classList.add('btn-filter-active');
        showToast('Filtre Aktif', 'node_modules, .git vb. ağır klasörler gizlendi.', 'info', 2500);
      } else {
        filterBtn.classList.remove('btn-filter-active');
        showToast('Filtre Kapalı', 'Tüm dosya ve klasörler gösteriliyor.', 'info', 2000);
      }
      renderLocalTable();
      if (state.connected) renderRemoteTable();
    });
  }

  // Settings Modal Events
  document.querySelector('#btn-settings')?.addEventListener('click', openSettingsModal);
  document.querySelector('#close-settings-modal')?.addEventListener('click', closeSettingsModal);
  document.querySelector('#btn-settings-cancel')?.addEventListener('click', closeSettingsModal);
  document.querySelector('#btn-settings-save')?.addEventListener('click', saveSettingsFromModal);
  document.querySelector('#setting-workers-slider')?.addEventListener('input', (e) => {
    const val = document.querySelector('#setting-workers-val');
    if (val) val.textContent = e.target.value;
  });

  // Close modals on clicking their dark backdrop outside
  ['#settings-modal', '#shortcuts-modal', '#site-modal', '#editor-modal', '#chmod-modal', '#image-preview-modal'].forEach(sel => {
    document.querySelector(sel)?.addEventListener('click', (e) => {
      if (e.target.matches(sel)) {
        e.target.classList.add('hidden');
      }
    });
  });

  // Breadcrumb Path Mode Toggles
  document.querySelector('#btn-local-path-mode')?.addEventListener('click', () => {
    const input = document.querySelector('#local-path-input');
    const isHidden = input.style.display === 'none' || input.classList.contains('hidden');
    togglePathInputMode('local', isHidden);
  });
  document.querySelector('#btn-remote-path-mode')?.addEventListener('click', () => {
    const input = document.querySelector('#remote-path-input');
    const isHidden = input.style.display === 'none' || input.classList.contains('hidden');
    togglePathInputMode('remote', isHidden);
  });

  // Context Menu: Edit / View
  document.querySelector('#ctx-edit')?.addEventListener('click', () => {
    if (!state.contextTarget || !state.contextTarget.item) return;
    const { pane, item } = state.contextTarget;
    const isRemote = pane === 'remote';
    if (isImage(item)) {
      openImagePreview(item, isRemote);
    } else {
      openFileInEditor(item, isRemote);
    }
  });

  // Context Menu: CHMOD
  document.querySelector('#ctx-chmod')?.addEventListener('click', () => {
    if (!state.contextTarget || !state.contextTarget.item) return;
    openChmodModal(state.contextTarget.item);
  });

  // Editor Modal Events
  document.querySelector('#btn-editor-save')?.addEventListener('click', saveEditorContent);
  document.querySelector('#close-editor-modal')?.addEventListener('click', closeEditorModal);
  document.querySelector('#editor-textarea')?.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveEditorContent();
    }
  });

  // Image Preview Modal Events
  document.querySelector('#close-image-modal')?.addEventListener('click', closeImageModal);

  // CHMOD Modal Events
  document.querySelector('#close-chmod-modal')?.addEventListener('click', closeChmodModal);
  document.querySelector('#btn-chmod-cancel')?.addEventListener('click', closeChmodModal);
  document.querySelector('#btn-chmod-apply')?.addEventListener('click', applyChmodFromModal);
  document.querySelector('#chmod-octal-input')?.addEventListener('input', (e) => {
    syncCheckboxesFromOctal(e.target.value);
  });
  ['#chmod-owner-r', '#chmod-owner-w', '#chmod-owner-x',
   '#chmod-group-r', '#chmod-group-w', '#chmod-group-x',
   '#chmod-public-r', '#chmod-public-w', '#chmod-public-x'].forEach(id => {
    document.querySelector(id)?.addEventListener('change', syncOctalFromCheckboxes);
  });

  // Shortcuts modal
  const shortcutsModal = document.querySelector('#shortcuts-modal');
  const btnShortcuts = document.querySelector('#btn-shortcuts');
  const closeShortcuts = document.querySelector('#close-shortcuts-modal');
  if (btnShortcuts && shortcutsModal) {
    btnShortcuts.addEventListener('click', () => shortcutsModal.classList.remove('hidden'));
  }
  if (closeShortcuts && shortcutsModal) {
    closeShortcuts.addEventListener('click', () => shortcutsModal.classList.add('hidden'));
  }

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      closeEditorModal();
      closeImageModal();
      closeChmodModal();
      closeSettingsModal();
      shortcutsModal?.classList.add('hidden');
      document.querySelector('#site-modal')?.classList.add('hidden');
      document.querySelector('#prompt-modal')?.classList.add('hidden');
      return;
    }

    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
      return;
    }

    if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
      e.preventDefault();
      loadLocalFiles();
      if (state.connected) {
        try {
          if (typeof ClearRemoteCache === 'function') await ClearRemoteCache();
        } catch (_) {}
        loadRemoteFiles();
      }
      showToast('Yenilendi', 'Dosya listeleri güncellendi.', 'info');
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      goLocalUp();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      handleDeleteSelected();
    } else if (e.key === 'F2') {
      e.preventDefault();
      handleRenameSelected();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.querySelector('#local-search')?.focus();
    }
  });

  setupDragAndDrop();
}

function handleDeleteSelected() {
  if (state.selectedLocal.size > 0) {
    if (confirm(`${state.selectedLocal.size} yerel öğeyi silmek istediğinize emin misiniz?`)) {
      state.selectedLocal.forEach(p => {
        const item = state.localFiles.find(f => f.path === p);
        if (item) DeleteLocal(item.path, item.isDir).then(() => loadLocalFiles());
      });
      showToast('Silindi', `${state.selectedLocal.size} dosya silindi.`, 'info');
      state.selectedLocal.clear();
    }
  } else if (state.selectedRemote.size > 0 && state.connected) {
    if (confirm(`${state.selectedRemote.size} uzak öğeyi silmek istediğinize emin misiniz?`)) {
      state.selectedRemote.forEach(p => {
        const item = state.remoteFiles.find(f => f.path === p);
        if (item) DeleteRemote(item.path, item.isDir).then(() => loadRemoteFiles());
      });
      showToast('Silindi', `${state.selectedRemote.size} uzak dosya silindi.`, 'info');
      state.selectedRemote.clear();
    }
  }
}

function handleRenameSelected() {
  let target = null;
  if (state.selectedLocal.size === 1) {
    const p = Array.from(state.selectedLocal)[0];
    const item = state.localFiles.find(f => f.path === p);
    if (item) target = { pane: 'local', item };
  } else if (state.selectedRemote.size === 1 && state.connected) {
    const p = Array.from(state.selectedRemote)[0];
    const item = state.remoteFiles.find(f => f.path === p);
    if (item) target = { pane: 'remote', item };
  }

  if (target) {
    showPromptModal('Yeniden Adlandır', 'Yeni adı girin:', target.item.name, async (newName) => {
      if (!newName || newName === target.item.name) return;
      if (target.pane === 'local') {
        await RenameLocal(target.item.path, state.localPath + '\\' + newName);
        loadLocalFiles();
      } else {
        const dir = state.remotePath === '/' ? '' : state.remotePath;
        await RenameRemote(target.item.path, dir + '/' + newName);
        loadRemoteFiles();
      }
      showToast('Yeniden Adlandırıldı', `"${newName}" olarak güncellendi.`, 'success');
    });
  }
}

// ====================================================================
// DRAG AND DROP BETWEEN PANES
// ====================================================================
function setupDragAndDrop() {
  const localContainer = document.querySelector('#local-table-container');
  const remoteContainer = document.querySelector('#remote-table-container');
  if (!localContainer || !remoteContainer) return;

  // Remote table accepts drops from Local
  remoteContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    remoteContainer.classList.add('drag-over');
  });
  remoteContainer.addEventListener('dragleave', () => {
    remoteContainer.classList.remove('drag-over');
  });
  remoteContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    remoteContainer.classList.remove('drag-over');
    if (!state.connected) {
      showToast('Bağlantı Yok', 'Dosya yüklemek için önce bir uzak sunucuya bağlanın.', 'error');
      return;
    }
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
      if (data.source === 'local' && Array.isArray(data.paths)) {
        data.paths.forEach(p => {
          const item = state.localFiles.find(f => f.path === p);
          if (item && !item.isDir) {
            QueueUpload(item.path, state.remotePath, item.size);
          }
        });
        showToast('Kuyruğa Eklendi', `${data.paths.length} dosya karşıya yükleme kuyruğunda.`, 'info');
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  });

  // Local table accepts drops from Remote
  localContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    localContainer.classList.add('drag-over');
  });
  localContainer.addEventListener('dragleave', () => {
    localContainer.classList.remove('drag-over');
  });
  localContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    localContainer.classList.remove('drag-over');
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
      if (data.source === 'remote' && Array.isArray(data.paths)) {
        data.paths.forEach(p => {
          const item = state.remoteFiles.find(f => f.path === p);
          if (item && !item.isDir) {
            QueueDownload(item.path, state.localPath, item.size);
          }
        });
        showToast('Kuyruğa Eklendi', `${data.paths.length} dosya indirme kuyruğunda.`, 'info');
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  });
}

// ====================================================================
// QUICK PATHS (Masaüstü, İndirilenler, vb.)
// ====================================================================
async function loadQuickPaths() {
  const container = document.querySelector('#local-quick-paths');
  if (!container) return;

  try {
    let paths = [];
    if (window['go']?.['main']?.['App']?.['GetQuickPaths']) {
      paths = await window['go']['main']['App']['GetQuickPaths']();
    }
    if (!paths || paths.length === 0) {
      paths = [
        { name: 'Ana Dizin', path: state.localPath }
      ];
    }

    container.innerHTML = paths.map(p => `
      <button class="quick-path-pill" data-path="${escapeHtml(p.path)}" title="${escapeHtml(p.path)}">
        ${ICONS.pin}
        <span>${escapeHtml(p.name)}</span>
      </button>
    `).join('');

    container.querySelectorAll('.quick-path-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        loadLocalFiles(btn.dataset.path);
        showToast('Konum Açıldı', btn.dataset.path, 'info', 2000);
      });
    });
  } catch (err) {
    console.error('Quick paths error:', err);
  }
}

// ====================================================================
// WAILS RUNTIME EVENTS
// ====================================================================
const notifiedCompleted = new Set();

function setupWailsListeners() {
  // Listen for real-time logs
  EventsOn('ftp_log', (msg) => {
    addLogLine(msg);
  });

  // Listen for real-time transfer progress updates
  EventsOn('transfer_update', (tasks) => {
    state.tasks = tasks || [];
    renderQueue();

    // Check if any task recently finished
    let newlyFinished = false;
    tasks.forEach(t => {
      if (t.status === 'completed' && !notifiedCompleted.has(t.id)) {
        notifiedCompleted.add(t.id);
        newlyFinished = true;
        showToast('Aktarım Başarılı', `${t.name} (${t.direction === 'upload' ? 'Karşıya Yüklendi' : 'İndirildi'})`, 'success');
      }
    });

    if (newlyFinished) {
      loadLocalFiles();
      if (state.connected) {
        loadRemoteFiles();
      }
    }
  });
}

// ====================================================================
// APPLICATION BOOTSTRAP
// ====================================================================
async function init() {
  renderAppShell();
  setupEventListeners();
  setupWailsListeners();

  // Load saved settings
  try {
    const settings = await GetSettings();
    if (settings) {
      state.filterDev = !!settings.filterDevFiles;
      state.filterHidden = !settings.filterHiddenFiles;
      state.syncBrowsing = !!settings.syncBrowsing;
      
      const filterBtn = document.querySelector('#btn-filter-dev');
      if (filterBtn && state.filterDev) filterBtn.classList.add('btn-filter-active');

      const syncBtn = document.querySelector('#btn-sync-browsing');
      if (syncBtn && state.syncBrowsing) syncBtn.classList.add('btn-toggle-active');
    }
  } catch (err) {
    console.error('Settings err:', err);
  }

  // Load local drives
  try {
    const drives = await GetLocalDrives();
    state.localDrives = drives || [];
    const select = document.querySelector('#local-drive-select');
    if (select) {
      select.innerHTML = state.localDrives.map(d => `<option value="${d}">${d}</option>`).join('');
    }
  } catch (err) {
    console.error('Drives err:', err);
  }

  // Load default local path
  try {
    const defaultPath = await GetDefaultLocalPath();
    state.localPath = defaultPath;
    await loadLocalFiles(defaultPath);
  } catch (err) {
    console.error('Local path err:', err);
  }

  // Load Quick Paths
  loadQuickPaths();

  // Check initial connection
  try {
    const conn = await GetConnectionStatus();
    if (conn.connected) {
      state.connected = true;
      loadRemoteFiles(conn.currentDir);
    }
  } catch (err) {
    // not connected initially
  }

  renderRemoteTable();
  renderQueue();
}

// Start safely when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => console.error('Init error:', err));
  });
} else {
  init().catch(err => console.error('Init error:', err));
}
