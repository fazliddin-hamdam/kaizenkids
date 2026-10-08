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
export function validateInitData(initData: string, botToken: string, maxAgeSec: number): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get('user') ?? '') as TelegramUser;
    return typeof user?.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

/** Express'te doğrulanmış aileye erişim: res.locals.family */
export type AuthedLocals = { family: Family };

/**
 * İstek başlığı: `Authorization: tma <initData>`
 * Doğrulanan Telegram kullanıcısı = ebeveyn → aile kaydı bulunur/oluşturulur.
 * Geliştirmede DEV_AUTH_BYPASS=true ise Telegram dışından DEV_USER_ID ile girilebilir.
 */
export function telegramAuth(req: Request, res: Response<unknown, AuthedLocals>, next: NextFunction): void {
  const [scheme, initData] = (req.header('authorization') ?? '').split(' ');
  let user: TelegramUser | null = null;

  if (scheme === 'tma' && initData) {
    user = validateInitData(initData, config.botToken, config.initDataMaxAgeSec);
  } else if (config.devAuthBypass && !config.isProduction && config.devUserId) {
    user = { id: config.devUserId, first_name: 'Geliştirici' };
  }

  if (!user) {
    res.status(401).json({ error: 'Bu uygulama Telegram içinden açılmalı.' });
    return;
  }

  res.locals.family = repo.getOrCreateFamily(user.id, user.first_name);
  next();
}
