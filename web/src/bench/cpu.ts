// CPU implementations — plain TypeScript over typed arrays, single-threaded.
// Deliberately straightforward code: this represents what "process it in JS"
// costs, the honest baseline the GPU has to beat.

import { GAUSS_RADIUS, GAUSS_SIGMA, THRESHOLD, gaussianKernel } from "./image";

export type CpuInputs = {
  rgba: Uint8ClampedArray;
  gray: Float32Array;
  width: number;
  height: number;
};

export type CpuTask = (inputs: CpuInputs) => Float32Array | Uint8ClampedArray;

export function grayscale({ rgba, width, height }: CpuInputs): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return out;
}

export function invert({ rgba }: CpuInputs): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  for (let p = 0; p < rgba.length; p += 4) {
    out[p] = 255 - rgba[p];
    out[p + 1] = 255 - rgba[p + 1];
    out[p + 2] = 255 - rgba[p + 2];
    out[p + 3] = 255;
  }
  return out;
}

const kernel = gaussianKernel(GAUSS_RADIUS, GAUSS_SIGMA);

export function gaussianBlur({ gray, width, height }: CpuInputs): Float32Array {
  const r = GAUSS_RADIUS;
  const tmp = new Float32Array(gray.length);
  const out = new Float32Array(gray.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        sum += kernel[k + r] * gray[row + xx];
      }
      tmp[row + x] = sum;
    }
  }
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        sum += kernel[k + r] * tmp[yy * width + x];
      }
      out[y * width + x] = sum;
    }
  }
  return out;
}

export function threshold({ gray }: CpuInputs): Float32Array {
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] > THRESHOLD ? 255 : 0;
  }
  return out;
}

export function sobel({ gray, width, height }: CpuInputs): Float32Array {
  const out = new Float32Array(gray.length);
  const clampX = (x: number) => Math.min(width - 1, Math.max(0, x));
  const clampY = (y: number) => Math.min(height - 1, Math.max(0, y));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = clampX(x - 1), x2 = clampX(x + 1);
      const y0 = clampY(y - 1) * width, y1 = y * width, y2 = clampY(y + 1) * width;
      const gx =
        -gray[y0 + x0] + gray[y0 + x2] +
        -2 * gray[y1 + x0] + 2 * gray[y1 + x2] +
        -gray[y2 + x0] + gray[y2 + x2];
      const gy =
        -gray[y0 + x0] - 2 * gray[y0 + x] - gray[y0 + x2] +
        gray[y2 + x0] + 2 * gray[y2 + x] + gray[y2 + x2];
      out[y1 + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return out;
}

export const CPU_TASKS: Record<string, CpuTask> = {
  grayscale,
  invert,
  gaussian_blur: gaussianBlur,
  threshold,
  sobel,
};
