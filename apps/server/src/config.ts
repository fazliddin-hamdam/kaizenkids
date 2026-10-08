import fs from 'node:fs';
import path from 'node:path';

/** Monorepo kök dizini (src/ ve dist/ aynı derinlikte olduğu için ikisinde de doğru çalışır). */
export const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');

// Kökteki .env dosyasını yükle (Node 22'nin yerleşik desteği; dotenv gerekmez).
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Eksik ortam değişkeni: ${name}. Lütfen .env dosyasını .env.example'a göre doldurun.`);
  }
  return value;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  webAppUrl: process.env.WEBAPP_URL ?? '',
  port: Number(process.env.PORT ?? 3000),
  dbPath: path.resolve(ROOT_DIR, process.env.DB_PATH ?? 'data/kaizenkids.db'),
  timezone: process.env.APP_TIMEZONE ?? 'Europe/Istanbul',
  boxThreshold: Math.max(1, Number(process.env.BOX_THRESHOLD ?? 50)),
  isProduction: process.env.NODE_ENV === 'production',
  devAuthBypass: process.env.DEV_AUTH_BYPASS === 'true',
  devUserId: Number(process.env.DEV_USER_ID ?? 0),
  /** initData bu süreden eskiyse reddedilir (saniye). */
  initDataMaxAgeSec: 24 * 60 * 60,
  webDistDir: path.join(ROOT_DIR, 'apps/web/dist'),
} as const;

/** Telegram, Mini App butonları için yalnızca HTTPS adreslerini kabul eder. */
export const hasValidWebAppUrl = config.webAppUrl.startsWith('https://');
