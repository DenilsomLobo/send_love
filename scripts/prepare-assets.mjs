import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('assets/game', { recursive: true });
const report = {};
for (const name of ['male', 'female']) {
  const path = `assets/generated/${name}-actions.png`;
  // Generated sheets have an approximate grid. Extract connected figures rather
  // than cutting through hands or picking up shoes from the preceding row.
  const { data: pixels, info: { width, height } } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const labels = new Int32Array(width * height), queue = new Int32Array(width * height), components = [];
  let id = 0;
  for (let pixel = 0; pixel < labels.length; pixel++) {
    if (labels[pixel] || pixels[pixel * 4 + 3] < 96) continue;
    id++; let head = 0, tail = 1, minX = width, minY = height, maxX = 0, maxY = 0;
    queue[0] = pixel; labels[pixel] = id;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (n < 0 || n >= labels.length || labels[n] || pixels[n * 4 + 3] < 96) continue;
        // Two male poses touch at the boundary; keep their extraction regions separate.
        if (name === 'male' && (y < 705) !== (Math.floor(n / width) < 705)) continue;
        labels[n] = id; queue[tail++] = n;
      }
    }
    if (tail > 5000) components.push({ id, left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, centerY: (minY + maxY) / 2 });
  }
  if (components.length !== 12) throw new Error(`${name}: expected 12 separate poses, found ${components.length}: ${JSON.stringify(components)}`);
  components.sort((a, b) => a.centerY - b.centerY);
  const ordered = [0, 4, 8].flatMap(start => components.slice(start, start + 4).sort((a, b) => a.left - b.left));
  const frames = [];
  for (const box of ordered) {
    const data = Buffer.alloc(box.width * box.height * 4);
    for (let y = 0; y < box.height; y++) for (let x = 0; x < box.width; x++) {
      const source = (box.top + y) * width + box.left + x;
      if (labels[source] !== box.id) continue;
      pixels.copy(data, (y * box.width + x) * 4, source * 4, source * 4 + 4);
    }
    frames.push(await sharp(data, { raw: { width: box.width, height: box.height, channels: 4 } }).png().toBuffer({ resolveWithObject: true }));
  }
  const scale = Math.min(474 / Math.max(...frames.map(f => f.info.width)), 470 / Math.max(...frames.map(f => f.info.height)));
  const inputs = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i], w = Math.round(f.info.width * scale), h = Math.round(f.info.height * scale);
    inputs.push({ input: await sharp(f.data).resize(w, h).png().toBuffer(), left: (i % 4) * 512 + Math.round((512 - w) / 2), top: Math.floor(i / 4) * 512 + 500 - h });
  }
  await sharp({ create: { width: 2048, height: 1536, channels: 4, background: '#00000000' } }).composite(inputs).webp({ quality: 88, alphaQuality: 100 }).toFile(`assets/game/${name}-actions.webp`);
  report[name] = { columns: 4, rows: 3, cell: 512, baseline: 500, frames: 12 };
}
for (const [source, name, width] of [['forest', 'forest', 1920], ['treehouse', 'treehouse', 1100], ['slingshot', 'slingshot', 400], ['catch-net', 'catch-net', 600]]) {
  await sharp(`assets/generated/${source}.png`).resize({ width, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toFile(`assets/game/${name}.webp`);
}
await writeFile('assets/game/animations.json', JSON.stringify(report, null, 2));
for (const [source, target, width] of [['personagem_masculino.png', 'male-portrait', 440], ['personagem_feminino.png', 'female-portrait', 440], ['projetil_aviao_de_papel.png', 'paper-plane', 360]]) {
  await sharp(`assets/${source}`).resize({ width, withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toFile(`assets/game/${target}.webp`);
}
console.log('Six game assets prepared; 24 poses aligned to a shared baseline.');
