import type { ChildrenResponse, DashboardState, OpenBoxResponse } from '../types';
import { getInitData, getLaunchInfo } from './telegram';

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
        ...(initData ? { Authorization: `tma ${initData}` } : { 'X-Telegram-Launch': getLaunchInfo() }),
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
  getChildren: () => request<ChildrenResponse>('/children'),
  getState: (childId: number) => request<DashboardState>(`/children/${childId}/state`),
  markDone: (childId: number, taskId: number) =>
    request<DashboardState>(`/children/${childId}/tasks/${taskId}/done`, { method: 'POST' }),
  openBox: (childId: number) => request<OpenBoxResponse>(`/children/${childId}/box/open`, { method: 'POST' }),
};
