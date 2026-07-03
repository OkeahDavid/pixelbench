// Benchmark orchestration: warmup, adaptive iteration counts, median timing,
// and CPU-vs-GPU output verification.
//
// Methodology notes (mirrors the CLI):
// - Inputs are prepared and uploaded to the GPU before timing starts,
//   so numbers measure compute, not transfer.
// - Warmup runs precede measurement (JIT for the CPU, pipeline/driver
//   warmup for the GPU).
// - Iteration counts adapt to op cost so slow ops don't take forever and
//   fast ops don't drown in timer noise.
// - Reported time is the median of individually timed samples.
// - GPU samples batch several dispatches per submit and divide, because
//   a single dispatch is shorter than submit overhead.

import { SIZES, makeTestImage, toGrayFloat } from "./image";
import { CPU_TASKS, type CpuInputs } from "./cpu";
import { createGpuTask, type GpuContext } from "./gpu";

export const TASK_LABELS: Record<string, string> = {
  grayscale: "Grayscale conversion",
  invert: "Color inversion",
  gaussian_blur: "Gaussian blur 9x9",
  threshold: "Binary threshold",
  sobel: "Sobel edges",
};

export type Measurement = {
  task: string;
  label: string;
  size: string;
  cpuMs: number;
  gpuMs: number | null;
  speedup: number | null;
  verified: boolean | null;
  gpuError: string | null;
};

export type Progress = (msg: string) => void;

const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

function median(samples: number[]): number {
  const s = [...samples].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Aim for ~400ms of measured work per op, within [5, 30] samples.
function sampleCount(estimateMs: number): number {
  return Math.max(5, Math.min(30, Math.round(400 / Math.max(estimateMs, 0.05))));
}

async function timeCpu(fn: () => unknown): Promise<number> {
  fn(); // warmup / JIT
  fn();
  const t0 = performance.now();
  fn();
  const estimate = performance.now() - t0;
  const n = sampleCount(estimate);
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    fn();
    samples.push(performance.now() - t);
    if (i % 5 === 4) await yieldToUI();
  }
  return median(samples);
}

async function timeGpu(run: (n: number) => Promise<void>): Promise<number> {
  await run(3); // warmup
  const t0 = performance.now();
  await run(1);
  const estimate = performance.now() - t0;
  // Batch enough iterations per submit that submit overhead is amortized.
  const perSubmit = Math.max(1, Math.min(20, Math.round(30 / Math.max(estimate, 0.1))));
  const n = sampleCount(estimate * perSubmit);
  const samples: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await run(perSubmit);
    samples.push((performance.now() - t) / perSubmit);
  }
  return median(samples);
}

function verify(
  cpuOut: Float32Array | Uint8ClampedArray,
  gpuOut: Float32Array | Uint32Array
): boolean {
  // Compare a deterministic sample of pixels with a small tolerance
  // (f32 vs f64 accumulation order differs).
  const n = cpuOut instanceof Uint8ClampedArray ? cpuOut.length / 4 : cpuOut.length;
  const step = Math.max(1, Math.floor(n / 2000));
  for (let i = 0; i < n; i += step) {
    let cpuV: number;
    let gpuV: number;
    if (gpuOut instanceof Uint32Array) {
      // Packed RGBA (invert): compare red channel.
      cpuV = (cpuOut as Uint8ClampedArray)[i * 4];
      gpuV = gpuOut[i] & 0xff;
    } else {
      cpuV = (cpuOut as Float32Array)[i];
      gpuV = gpuOut[i];
    }
    if (Math.abs(cpuV - gpuV) > 1.5) return false;
  }
  return true;
}

export async function runBenchmark(
  sizes: string[],
  gpu: GpuContext | null,
  progress: Progress
): Promise<Measurement[]> {
  const results: Measurement[] = [];

  for (const sizeName of sizes) {
    const [width, height] = SIZES[sizeName];
    progress(`${sizeName} — generating test image…`);
    await yieldToUI();
    const img = makeTestImage(width, height);
    const inputs: CpuInputs = {
      rgba: img.data,
      gray: toGrayFloat(img),
      width,
      height,
    };

    for (const [task, label] of Object.entries(TASK_LABELS)) {
      progress(`${sizeName} — ${label} (CPU)…`);
      await yieldToUI();
      const cpuFn = CPU_TASKS[task];
      const cpuMs = await timeCpu(() => cpuFn(inputs));

      let gpuMs: number | null = null;
      let verified: boolean | null = null;
      let gpuError: string | null = null;

      if (gpu) {
        progress(`${sizeName} — ${label} (GPU)…`);
        await yieldToUI();
        try {
          const instance = createGpuTask(gpu, task, inputs.rgba, inputs.gray, width, height);
          gpuMs = await timeGpu(instance.run);
          const gpuOut = await instance.readback();
          verified = verify(cpuFn(inputs), gpuOut);
          instance.destroy();
        } catch (e) {
          gpuError = e instanceof Error ? e.message.slice(0, 120) : String(e);
        }
      }

      results.push({
        task,
        label,
        size: sizeName,
        cpuMs,
        gpuMs,
        speedup: gpuMs ? cpuMs / gpuMs : null,
        verified,
        gpuError,
      });
    }
  }
  return results;
}
