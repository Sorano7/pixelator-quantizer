export type RGB = [number, number, number];

export function processImage(
  source: ImageData,
  pixelate: boolean,
  blockSize: number,
  quantize: boolean,
  paletteSize: number,
  maxKMeansIters = 8
): ImageData {
  const { width, height, data } = source;

  const copy = new ImageData(
    new Uint8ClampedArray(data), width, height
  );

  if (quantize) {
    const palette = buildPalette(copy, paletteSize, maxKMeansIters);
    qunatizeImage(copy, palette);
  }
  if (pixelate) pixelateImage(copy, blockSize);

  return copy;
}

function buildPalette(
  imageData: ImageData,
  k: number,
  maxIters = 8
): RGB[] {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  k = Math.max(1, Math.min(k, 256));

  const maxSamples = 5000;
  const step = Math.max(1, Math.floor(totalPixels / maxSamples));
  const samples: RGB[] = [];

  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    samples.push([r, g, b]);
  }

  if (samples.length === 0) return [[0, 0, 0]];

  const centers: RGB[] = [];
  for (let i = 0; i < k; i++) {
    const s = samples[Math.floor(Math.random() * samples.length)];
    centers.push([s[0], s[1], s[2]]);
  }

  const assignments = new Array(samples.length).fill(0);

  for (let iter = 0; iter < maxIters; iter++) {
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      let bestIdx = 0;
      let bestDist = Infinity;

      for (let c = 0; c < centers.length; c++) {
        const center = centers[c];
        const dr = p[0] - center[0];
        const dg = p[1] - center[1];
        const db = p[2] - center[2];
        const dist = dr * dr + dg * dg + db * db;

        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }

      assignments[i] = bestIdx;
    }

    const sums: [number, number, number][] = Array.from(
      { length: k }, () => [0, 0, 0]
    );
    const counts = new Array(k).fill(0);

    for (let i = 0; i < samples.length; i++) {
      const c = assignments[i];
      const p = samples[i];
      sums[c][0] += p[0];
      sums[c][1] += p[1];
      sums[c][2] += p[2];
      counts[c] += 1;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centers[c][0] = Math.round(sums[c][0] / counts[c]);
        centers[c][1] = Math.round(sums[c][1] / counts[c]);
        centers[c][2] = Math.round(sums[c][2] / counts[c]);
      } else {
        const s = samples[Math.floor(Math.random() * samples.length)];
        centers[c] = [s[0], s[1], s[2]];
      }
    }
  }

  return centers;
}

function qunatizeImage(
  imageData: ImageData,
  palette: RGB[]
): void {
  const { data } = imageData;
  const n = data.length / 4;

  for (let i = 0; i < n; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    let bestIdx = 0;
    let bestDist = Infinity;

    for (let p = 0; p < palette.length; p++) {
      const [pr, pg, pb] = palette[p];
      const dr = r - pr;
      const dg = g - pg;
      const db = b - pb;
      const dist = dr * dr + dg * dg + db * db;

      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = p;
      }
    }

    const [nr, ng, nb] = palette[bestIdx];
    data[idx] = nr;
    data[idx + 1] = ng;
    data[idx + 2] = nb;
  }
}

function pixelateImage(imageData: ImageData, blockSize: number): void {
  const { width, height, data } = imageData;
  const size = Math.max(1, Math.floor(blockSize));
  
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      const cx = Math.min(bx + Math.floor(size / 2), width - 1);
      const cy = Math.min(by + Math.floor(size / 2), height - 1);
      const cIdx = (cy * width + cx) * 4;

      const r = data[cIdx];
      const g = data[cIdx + 1];
      const b = data[cIdx + 2];
      const a = data[cIdx + 3];
      
      const maxY = Math.min(by + size, height);
      const maxX = Math.min(bx + size, width);

      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }
  }
}