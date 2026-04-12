import { setApiKey, login, fetchCaptures, fetchPointClouds, fetchPointCloudData } from './api';
import type { CaptureListItem, PointCloudInfo } from './api';
import { initViewer, loadPointCloudFromBuffer, unloadPointCloud } from './viewer';

const loginScreen = document.getElementById('login-screen')!;
const appScreen = document.getElementById('app-screen')!;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginPassword = document.getElementById('login-password') as HTMLInputElement;
const loginError = document.getElementById('login-error')!;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginRemember = document.getElementById('login-remember') as HTMLInputElement;
const sessionList = document.getElementById('session-list')!;
const pcList = document.getElementById('pc-list')!;
const viewerContainer = document.getElementById('viewer')!;
const statusEl = document.getElementById('status')!;
const refreshBtn = document.getElementById('refresh-btn')!;
const sidebarEl = document.getElementById('sidebar')!;
const toggleBtn = document.getElementById('sidebar-toggle')!;
const backBtn = document.getElementById('back-btn')!;
const logoutBtn = document.getElementById('logout-btn')!;
const viewerEmpty = viewerContainer.querySelector('.viewer-empty')!;

const REMEMBER_KEY = 'rb_remember_pw';
const SESSION_KEY = 'rb_logged_in';
const SPINNER = '<div class="spinner"></div>';

let viewerInitialised = false;
let selectedCaptureId: string | null = null;
let selectedPcFilename: string | null = null;

toggleBtn.addEventListener('click', () => {
  sidebarEl.classList.toggle('collapsed');
});

refreshBtn.addEventListener('click', () => {
  if (selectedCaptureId) {
    loadPointClouds(selectedCaptureId);
  } else {
    loadSessions();
  }
});

backBtn.addEventListener('click', () => {
  selectedCaptureId = null;
  selectedPcFilename = null;
  backBtn.classList.add('hidden');
  pcList.classList.add('hidden');
  sessionList.classList.remove('hidden');
  setStatus('');
  unloadPointCloud();
  viewerEmpty.classList.remove('hidden');
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  window.location.reload();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = loginPassword.value.trim();
  if (!pw) return;

  loginBtn.disabled = true;
  loginBtn.textContent = '…';
  loginError.classList.add('hidden');
  loginError.textContent = '';

  try {
    const ok = await login(pw);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, '1');
      if (loginRemember.checked) {
        localStorage.setItem(REMEMBER_KEY, pw);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      showApp();
    } else {
      loginError.textContent = 'Falsches Passwort.';
      loginError.classList.remove('hidden');
      loginPassword.focus();
    }
  } catch (err: unknown) {
    loginError.textContent = `Fehler: ${err instanceof Error ? err.message : err}`;
    loginError.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

const hasSession = sessionStorage.getItem(SESSION_KEY);
const remembered = localStorage.getItem(REMEMBER_KEY);

if (hasSession) {
  showApp();
} else if (remembered) {
  autoLogin(remembered);
} else {
  showLogin();
}

async function autoLogin(pw: string): Promise<void> {
  try {
    const ok = await login(pw);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, '1');
      showApp();
      return;
    }
  } catch {
  }
  loginPassword.value = pw;
  loginRemember.checked = true;
  showLogin();
}

function showLogin(): void {
  appScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

function showApp(): void {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  if (!viewerInitialised) {
    initViewer(viewerContainer as HTMLElement);
    viewerInitialised = true;
  }

  const envKey = (window.__ENV_API_KEY__ || '').trim();
  if (envKey) {
    setApiKey(envKey);
  }

  loadSessions();
}

async function loadSessions(): Promise<void> {
  sessionList.innerHTML = SPINNER;
  pcList.classList.add('hidden');
  backBtn.classList.add('hidden');
  sessionList.classList.remove('hidden');
  setStatus('');

  try {
    const captures = await fetchCaptures();

    if (captures.length === 0) {
      sessionList.innerHTML = '<div class="empty-state">No captures available.</div>';
      return;
    }

    sessionList.innerHTML = '';
    captures.forEach((c) => renderSessionItem(c));
  } catch {
    sessionList.innerHTML = '<div class="empty-state">No captures available.</div>';
  }
}

function renderSessionItem(capture: CaptureListItem): void {
  const el = document.createElement('button');
  el.className = 'list-item';
  el.innerHTML = `
    <div class="item-title">${capture.id}</div>
    <div class="item-meta">${capture.preprocessed_images} preprocessed · ${capture.raw_images} raw</div>
  `;
  el.addEventListener('click', () => {
    selectedCaptureId = capture.id;
    loadPointClouds(capture.id);
  });
  sessionList.appendChild(el);
}

async function loadPointClouds(captureId: string): Promise<void> {
  sessionList.classList.add('hidden');
  pcList.classList.remove('hidden');
  backBtn.classList.remove('hidden');
  pcList.innerHTML = SPINNER;
  setStatus('');

  try {
    const pcs = await fetchPointClouds(captureId);

    if (pcs.length === 0) {
      pcList.innerHTML = '<div class="empty-state">No point clouds found for this session.</div>';
      return;
    }

    pcList.innerHTML = '';
    pcs.forEach((pc) => renderPcItem(captureId, pc));
  } catch {
    pcList.innerHTML = '<div class="empty-state">No point clouds available.</div>';
  }
}

function renderPcItem(captureId: string, pc: PointCloudInfo): void {
  const el = document.createElement('button');
  el.className = 'list-item';
  const sizeMB = (pc.size_bytes / (1024 * 1024)).toFixed(1);
  el.innerHTML = `
    <div class="item-title">${pc.filename}</div>
    <div class="item-meta">${sizeMB} MB</div>
  `;
  el.addEventListener('click', () => selectPointCloud(captureId, pc, el));
  pcList.appendChild(el);
}

async function selectPointCloud(
  captureId: string,
  pc: PointCloudInfo,
  el: HTMLButtonElement,
): Promise<void> {
  if (selectedPcFilename === pc.filename) {
    selectedPcFilename = null;
    el.classList.remove('active');
    unloadPointCloud();
    viewerEmpty.classList.remove('hidden');
    setStatus('');
    return;
  }

  pcList.querySelectorAll('.list-item').forEach((item) => item.classList.remove('active'));
  el.classList.add('active');
  selectedPcFilename = pc.filename;

  setStatus('Downloading point cloud…');
  viewerEmpty.classList.add('hidden');
  try {
    const buffer = await fetchPointCloudData(captureId, pc.filename);
    if (selectedPcFilename !== pc.filename) return;

    loadPointCloudFromBuffer(buffer, (msg) => setStatus(msg));
    setStatus(`${pc.filename} loaded`);
  } catch (err: unknown) {
    setStatus(`Error: ${err instanceof Error ? err.message : err}`);
  }
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}
