let cachedLevels = null;

export async function loadLevels(url = '../levels.json') {
  if (cachedLevels) return cachedLevels;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load levels from ${url}`);
  const data = await res.json();
  cachedLevels = data.levels ?? [];
  return cachedLevels;
}

export async function loadLevel(index = 0, url = '../levels.json') {
  const levels = await loadLevels(url);
  if (!levels.length) throw new Error('No levels found in levels.json');
  return levels[Math.min(index, levels.length - 1)];
}
