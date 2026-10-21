const PREFIX = 'send-love.v1.';
let warning = () => {};
export function onStorageError(callback) { warning = callback; }
export function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback; }
  catch { return fallback; }
}
export function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { warning('Não foi possível salvar neste navegador. Você pode continuar jogando.'); return false; }
}
export function compareScores(a, b) { return b.phases - a.phases || b.score - a.score || a.date - b.date; }
export function rankings() {
  const data = read('ranking', []);
  return Array.isArray(data) ? data.filter(x => x && typeof x.name === 'string' && Number.isFinite(x.phases) && Number.isFinite(x.score)).sort(compareScores) : [];
}
export function saveScore(player, phases, score) {
  const entries = rankings();
  const result = { id: player.id, name: player.name, character: player.character, phases, score, date: Date.now() };
  const old = entries.find(x => x.id === player.id);
  if (!old || compareScores(result, old) < 0) {
    write('ranking', [...entries.filter(x => x.id !== player.id), result].sort(compareScores).slice(0, 100));
  }
}
