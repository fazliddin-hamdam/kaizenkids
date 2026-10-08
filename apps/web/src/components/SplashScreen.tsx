/** İlk yükleme ve hata ekranı. */
export function SplashScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-8 text-center">
      <div>
        <div className={`text-8xl ${error ? '' : 'animate-float'}`}>{error ? '🙈' : '🌱'}</div>
        <p className="mt-4 text-2xl font-extrabold text-slate-600">{error ?? 'Yükleniyor...'}</p>
        {error && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 h-14 rounded-2xl bg-sky-500 px-8 text-xl font-extrabold text-white shadow-[0_5px_0_#0369a1] active:translate-y-1"
          >
            Tekrar Dene
          </button>
        )}
      </div>
    </div>
  );
}
