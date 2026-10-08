import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // PORT değeri monorepo kökündeki .env dosyasından okunur.
  const env = loadEnv(mode, '../..', '');
  const apiPort = env.PORT || '3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      // cloudflared / ngrok tünel adreslerine izin ver (Telegram HTTPS ister).
      allowedHosts: true,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
  };
});
