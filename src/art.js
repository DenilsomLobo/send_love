export const ART = {
  male: new URL('../assets/game/male-actions.webp', import.meta.url).href,
  female: new URL('../assets/game/female-actions.webp', import.meta.url).href,
  forest: new URL('../assets/game/forest.webp', import.meta.url).href,
  tree: new URL('../assets/game/treehouse.webp', import.meta.url).href,
  sling: new URL('../assets/game/slingshot.webp', import.meta.url).href,
  net: new URL('../assets/game/catch-net.webp', import.meta.url).href,
  plane: new URL('../assets/game/paper-plane.webp', import.meta.url).href,
};

export function animationFrame(action, time, power = 0) {
  if (action === 'aim') return power > .55 ? 3 : 2;
  if (action === 'release') return time < .18 ? 4 : time < .6 ? 5 : 0;
  if (action === 'wait') return 6;
  if (action === 'capture') return time < .35 ? 7 : 8 + Math.floor(time * 4) % 2;
  if (action === 'happy') return 8 + Math.floor(time * 4) % 2;
  if (action === 'sad') return 10 + Math.floor(time * 1.5) % 2;
  return time % 4.7 > 4.5 ? 1 : 0;
}
