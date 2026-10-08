#!/usr/bin/env node
/**
 * KaizenKids'i bu bilgisayarda sürekli çalıştırır (ücretsiz, alan adı gerekmez).
 *
 *   node scripts/local-server.mjs start      → derle + tünel + sunucu (çökerse yeniden başlatır)
 *   node scripts/local-server.mjs stop       → arka planda çalışanı durdur
 *   node scripts/local-server.mjs status     → çalışıyor mu, adresi ne?
 *   node scripts/local-server.mjs install    → Windows açılışında otomatik başlat + şimdi başlat
 *   node scripts/local-server.mjs uninstall  → otomatik başlatmayı kaldır + durdur
 *
 * Ücretsiz Cloudflare tünelinin adresi her açılışta değişir. Bu betik yeni adresi yakalar ve
 * sunucuya WEBAPP_URL olarak verir; sunucu da bottaki "KaizenKids" menü butonunu günceller.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'kaizenkids.log');
const STATE_FILE = path.join(LOG_DIR, 'state.json');
const CLOUDFLARED = path.join(ROOT, 'cloudflared.exe');
const SERVER_ENTRY = path.join(ROOT, 'apps/server/dist/index.js');
const VBS_LAUNCHER = path.join(ROOT, 'scripts/arka-planda-baslat.vbs');
const STARTUP_SHORTCUT = path.join(
  os.homedir(),
  'AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/KaizenKids.lnk',
);
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const TUNNEL_URL_TIMEOUT_MS = 60_000;

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const PORT = process.env.PORT ?? '3000';

// ---------------------------------------------------------------------------
//  Yardımcılar
// ---------------------------------------------------------------------------

fs.mkdirSync(LOG_DIR, { recursive: true });

function log(message) {
  const line = `[${new Date().toLocaleString('tr-TR')}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + os.EOL);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(patch) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Çalışan bir başlatıcı varsa PID'ini döndürür. */
function runningPid() {
  const state = readState();
  return state && isAlive(state.pid) && state.pid !== process.pid ? state.pid : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Alt sürecin çıktısını satır satır log dosyasına yazar. */
function pipeToLog(child, prefix, onLine) {
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        onLine?.(line);
        fs.appendFileSync(LOG_FILE, `${prefix} ${line}${os.EOL}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
//  start: tünel + sunucu, çökerse yeniden başlat
// ---------------------------------------------------------------------------

/** cloudflared'i başlatır ve verdiği https adresini bekler. */
function startTunnel() {
  return new Promise((resolve, reject) => {
    const child = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], {
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Tünel adresi 60 saniyede alınamadı (internet bağlantısı var mı?)'));
    }, TUNNEL_URL_TIMEOUT_MS);

    pipeToLog(child, '[tünel]', (line) => {
      const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, url: match[0] });
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Tünel kapandı (kod ${code})`));
    });
  });
}

function startServer(webAppUrl) {
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', WEBAPP_URL: webAppUrl, PORT },
  });
  pipeToLog(child, '[sunucu]');
  return child;
}

/** İki süreçten biri kapanana kadar bekler. */
function waitForFirstExit(...children) {
  return new Promise((resolve) => {
    for (const child of children) child.once('exit', (code) => resolve({ child, code }));
  });
}

function build() {
  log('📦 Uygulama derleniyor...');
  const result = spawnSync('npm', ['run', 'build'], { cwd: ROOT, shell: true, encoding: 'utf8', windowsHide: true });
  fs.appendFileSync(LOG_FILE, (result.stdout ?? '') + (result.stderr ?? ''));
  if (result.status === 0) return log('✅ Derleme tamam.');
  if (fs.existsSync(SERVER_ENTRY)) return log('⚠️  Derleme başarısız; önceki derleme ile devam ediliyor.');
  throw new Error('Derleme başarısız ve önceki derleme yok. Ayrıntılar log dosyasında.');
}

async function start() {
  const existing = runningPid();
  if (existing) {
    console.log(`KaizenKids zaten çalışıyor (PID ${existing}). Durdurmak için: npm run local:stop`);
    return;
  }
  if (!fs.existsSync(CLOUDFLARED)) throw new Error(`cloudflared.exe bulunamadı: ${CLOUDFLARED}`);
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) fs.rmSync(LOG_FILE);

  writeState({ pid: process.pid, url: null, startedAt: new Date().toISOString() });
  log(`🚀 KaizenKids başlatıcı açıldı (PID ${process.pid}).`);
  build();

  let current = [];
  const shutdown = () => {
    for (const child of current) child.kill();
    log('🛑 Durduruldu.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  let retryDelay = 5_000;
  for (;;) {
    try {
      const tunnel = await startTunnel();
      log(`🌐 Tünel adresi: ${tunnel.url}`);
      const server = startServer(tunnel.url);
      current = [tunnel.child, server];
      writeState({ url: tunnel.url, connectedAt: new Date().toISOString() });

      const startedAt = Date.now();
      const { child, code } = await waitForFirstExit(tunnel.child, server);
      log(`⚠️  ${child === server ? 'Sunucu' : 'Tünel'} kapandı (kod ${code}); ikisi de yeniden başlatılacak.`);
      for (const c of current) c.kill();
      current = [];
      // Uzun süre sorunsuz çalıştıysa bekleme süresini sıfırla.
      if (Date.now() - startedAt > 5 * 60_000) retryDelay = 5_000;
    } catch (error) {
      log(`❌ ${error.message}`);
      for (const c of current) c.kill();
      current = [];
    }
    writeState({ url: null });
    log(`⏳ ${retryDelay / 1000} sn sonra tekrar denenecek...`);
    await sleep(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60_000);
  }
}

// ---------------------------------------------------------------------------
//  stop / status / install / uninstall
// ---------------------------------------------------------------------------

function stop() {
  const pid = runningPid();
  if (!pid) return console.log('KaizenKids zaten çalışmıyor.');
  // /T: başlatıcıyla birlikte tünel ve sunucu süreçlerini de kapatır.
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  writeState({ pid: null, url: null });
  log(`🛑 Durduruldu (PID ${pid}).`);
}

function status() {
  const pid = runningPid();
  const state = readState();
  console.log(pid ? `✅ Çalışıyor (PID ${pid})` : '⛔ Çalışmıyor');
  if (pid) console.log(`   Adres: ${state?.url ?? '(tünel bağlanıyor...)'}`);
  console.log(`   Otomatik başlatma: ${fs.existsSync(STARTUP_SHORTCUT) ? 'açık' : 'kapalı'}`);
  console.log(`   Log dosyası: ${LOG_FILE}`);
}

/** Arka planda (pencere açmadan) başlatır. */
function launchHidden() {
  spawn('wscript.exe', [VBS_LAUNCHER], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

function install() {
  const ps = [
    '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SHORTCUT)',
    '$s.TargetPath = "wscript.exe"',
    '$s.Arguments = \'"\' + $env:VBS + \'"\'',
    '$s.WorkingDirectory = $env:ROOT',
    '$s.Description = "KaizenKids bot sunucusu"',
    '$s.Save()',
  ].join('; ');
  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
    env: { ...process.env, SHORTCUT: STARTUP_SHORTCUT, VBS: VBS_LAUNCHER, ROOT },
    windowsHide: true,
  });
  console.log('✅ Otomatik başlatma açıldı (Windows oturumu açılınca KaizenKids arka planda başlar).');
  if (runningPid()) return console.log('ℹ️  Zaten çalışıyor.');
  launchHidden();
  console.log('🚀 Şimdi arka planda başlatıldı. Durum için: npm run local:status');
}

function uninstall() {
  if (fs.existsSync(STARTUP_SHORTCUT)) fs.rmSync(STARTUP_SHORTCUT);
  console.log('✅ Otomatik başlatma kapatıldı.');
  stop();
}

const commands = { start, stop, status, install, uninstall };
const command = commands[process.argv[2] ?? 'start'];
if (!command) {
  console.log('Kullanım: node scripts/local-server.mjs [start|stop|status|install|uninstall]');
  process.exit(1);
}
try {
  await command();
} catch (error) {
  log(`❌ ${error.message}`);
  process.exit(1);
}
