import confetti from 'canvas-confetti';

const COLORS = ['#f472b6', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#fb923c'];

/** Görev onaylandığında kısa bir konfeti patlaması. */
export function burst(): void {
  confetti({ particleCount: 120, spread: 80, startVelocity: 45, origin: { y: 0.6 }, colors: COLORS });
}

/** Sürpriz Kutu açıldığında iki yandan daha uzun bir kutlama. */
export function fireworks(): void {
  const end = Date.now() + 1500;
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS });
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
