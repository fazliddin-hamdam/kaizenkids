import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'error';
}

const TONE: Record<ToastMessage['tone'], string> = {
  info: 'bg-sky-500',
  warn: 'bg-orange-500',
  error: 'bg-rose-500',
};

/** Ekranın altında kısa süreli bilgi balonu. */
export function Toast({ message, onClose }: { message: ToastMessage; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [message.id, onClose]);

  return (
    <div className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md" onClick={onClose}>
      <p
        className={`animate-pop rounded-2xl px-5 py-4 text-center text-lg font-bold text-white shadow-xl ${TONE[message.tone]}`}
      >
        {message.text}
      </p>
    </div>
  );
}
