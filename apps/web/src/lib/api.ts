import type { DashboardState, OpenBoxResponse } from '../types';
import { getInitData } from './telegram';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const initData = getInitData();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // Sunucu bu başlıktaki imzayı bot token'ı ile doğrular.
        ...(initData ? { Authorization: `tma ${initData}` } : {}),
      },
    });
  } catch {
    throw new ApiError(0, 'İnternet bağlantısı yok gibi görünüyor. 📡');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? 'Bir şeyler ters gitti. Tekrar dene!');
  }
  return body as T;
}

export const api = {
  getState: () => request<DashboardState>('/state'),
  markDone: (taskId: number) => request<DashboardState>(`/tasks/${taskId}/done`, { method: 'POST' }),
  openBox: () => request<OpenBoxResponse>('/box/open', { method: 'POST' }),
};
