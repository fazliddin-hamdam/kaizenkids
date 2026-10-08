import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import * as repo from '../db/repo.js';
import type { Family } from '../types.js';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Mini App initData imzasını doğrular.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 *  secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
 *  hash       = HMAC_SHA256(key=secret_key, data=data_check_string)
 */
export type InitDataResult = { ok: true; user: TelegramUser } | { ok: false; reason: string };

export function validateInitData(initData: string, botToken: string, maxAgeSec: number): InitDataResult {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'hash alanı yok' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return { ok: false, reason: `imza tutmuyor (alanlar: ${[...params.keys()].join(', ')})` };
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate) return { ok: false, reason: 'auth_date yok' };
  const ageSec = Math.round(Date.now() / 1000 - authDate);
  if (ageSec > maxAgeSec) return { ok: false, reason: `initData süresi dolmuş (${ageSec} sn önce)` };

  try {
    const user = JSON.parse(params.get('user') ?? '') as TelegramUser;
    return typeof user?.id === 'number' ? { ok: true, user } : { ok: false, reason: 'user alanı geçersiz' };
  } catch {
    return { ok: false, reason: 'user alanı okunamadı' };
  }
}

/** Express'te doğrulanmış aileye erişim: res.locals.family */
export type AuthedLocals = { family: Family };

/**
 * İstek bu bilgisayardan mı geliyor? Tünel (cloudflared) üzerinden gelen istekler Host başlığında
 * tünel adresini ve yönlendirme başlıklarını taşır; bunlar geliştirici kestirmesinden yararlanamaz.
 */
function isLocalRequest(req: Request): boolean {
  const host = (req.header('host') ?? '').replace(/:\d+$/, '');
  const forwarded = req.header('x-forwarded-for') || req.header('cf-connecting-ip');
  return !forwarded && ['localhost', '127.0.0.1', '[::1]'].includes(host);
}

/**
 * İstek başlığı: `Authorization: tma <initData>`
 * Doğrulanan Telegram kullanıcısı = ebeveyn → aile kaydı bulunur/oluşturulur.
 * Geliştirmede DEV_AUTH_BYPASS=true ise Telegram dışından DEV_USER_ID ile girilebilir.
 */
export function telegramAuth(req: Request, res: Response<unknown, AuthedLocals>, next: NextFunction): void {
  const [scheme, initData] = (req.header('authorization') ?? '').split(' ');
  let user: TelegramUser | null = null;
  let reason = 'Authorization başlığı yok (initData boş geldi)';

  if (scheme === 'tma' && initData) {
    const result = validateInitData(initData, config.botToken, config.initDataMaxAgeSec);
    if (result.ok) user = result.user;
    else reason = result.reason;
  } else if (config.devAuthBypass && !config.isProduction && config.devUserId) {
    if (isLocalRequest(req)) user = { id: config.devUserId, first_name: 'Geliştirici' };
    else reason = 'DEV_AUTH_BYPASS yalnızca bu bilgisayardan (localhost) gelen isteklerde geçerlidir';
  }

  if (!user) {
    const launch = req.header('x-telegram-launch');
    console.warn(`🔒 ${req.method} ${req.originalUrl} reddedildi: ${reason}${launch ? ` [${launch}]` : ''}`);
    res.status(401).json({ error: 'Bu uygulama Telegram içinden açılmalı.' });
    return;
  }

  res.locals.family = repo.getOrCreateFamily(user.id, user.first_name);
  next();
}
