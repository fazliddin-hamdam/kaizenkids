import fs from 'node:fs';
import express, { type ErrorRequestHandler } from 'express';
import { config } from '../config.js';
import { AppError } from '../services/approval.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', apiRouter);

  // Üretimde derlenmiş Mini App'i aynı sunucudan servis et (tek HTTPS adresi yeterli olur).
  if (fs.existsSync(config.webDistDir)) {
    app.use(express.static(config.webDistDir));
  }

  // Express 5, async handler'lardaki hataları otomatik olarak buraya iletir.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('Beklenmeyen hata:', err);
    res.status(500).json({ error: 'Bir şeyler ters gitti. Lütfen tekrar dene.' });
  };
  app.use(errorHandler);

  return app;
}
