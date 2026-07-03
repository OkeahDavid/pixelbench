// Deterministic synthetic test image — gradients + circles + noise, so
// filters see both flat regions and hard edges. Mirrors the CLI's generator:
// every visitor benchmarks the exact same pixels.

export const SIZES: Record<string, [number, number]> = {
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "4K": [3840, 2160],
};

// Small deterministic PRNG (mulberry32) — Math.random isn't seedable.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTestImage(width: number, height: number, seed = 42): ImageData {
  const rand = mulberry32(seed);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#000000");
  grad.addColorStop(0.5, "#7f7f40");
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 40; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 10 + rand() * (Math.min(width, height) / 8);
    ctx.fillStyle = `rgb(${(rand() * 256) | 0},${(rand() * 256) | 0},${(rand() * 256) | 0})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = ((rand() * 31) | 0) - 15;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
    d[i + 3] = 255;
  }
  return img;
}

// Grayscale Float32Array from RGBA — several tasks consume this as input.
export function toGrayFloat(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return gray;
}

// Normalized 1-D Gaussian kernel, shared by the CPU path and injected into
// the WGSL shader source — both backends do literally the same math.
export function gaussianKernel(radius = 4, sigma = 2.0): Float32Array {
  const k = new Float32Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

export const GAUSS_RADIUS = 4;
export const GAUSS_SIGMA = 2.0;
export const THRESHOLD = 127.0;
