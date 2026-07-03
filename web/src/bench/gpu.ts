// GPU implementations — WebGPU compute shaders (WGSL), one thread per pixel.
// The Gaussian kernel weights are injected from the same JS function the CPU
// path uses, so both backends run literally the same math.

import { GAUSS_RADIUS, GAUSS_SIGMA, THRESHOLD, gaussianKernel } from "./image";

const WG = 8; // 8x8 workgroup

const header = /* wgsl */ `
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<uniform> params: Params;

fn idx(x: u32, y: u32) -> u32 { return y * params.width + x; }
`;

const guard = /* wgsl */ `
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let i = idx(gid.x, gid.y);
`;

const GRAYSCALE = /* wgsl */ `${header}
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  ${guard}
  let px = src[i];
  let r = f32(px & 0xFFu);
  let g = f32((px >> 8u) & 0xFFu);
  let b = f32((px >> 16u) & 0xFFu);
  dst[i] = 0.299 * r + 0.587 * g + 0.114 * b;
}`;

const INVERT = /* wgsl */ `${header}
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;

@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  ${guard}
  let px = src[i];
  dst[i] = 0xFF000000u | (~px & 0x00FFFFFFu);
}`;

function gaussSource(): { horizontal: string; vertical: string } {
  const k = gaussianKernel(GAUSS_RADIUS, GAUSS_SIGMA);
  const weights = Array.from(k, (v) => v.toFixed(8)).join(", ");
  const common = `${header}
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
const K = array<f32, ${k.length}>(${weights});
`;
  const body = (axis: "x" | "y") => `
@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  ${guard}
  var sum = 0.0;
  for (var k = -${GAUSS_RADIUS}; k <= ${GAUSS_RADIUS}; k++) {
    ${
      axis === "x"
        ? `let xx = u32(clamp(i32(gid.x) + k, 0, i32(params.width) - 1));
    sum += K[k + ${GAUSS_RADIUS}] * src[idx(xx, gid.y)];`
        : `let yy = u32(clamp(i32(gid.y) + k, 0, i32(params.height) - 1));
    sum += K[k + ${GAUSS_RADIUS}] * src[idx(gid.x, yy)];`
    }
  }
  dst[i] = sum;
}`;
  return { horizontal: common + body("x"), vertical: common + body("y") };
}

const THRESHOLD_SRC = /* wgsl */ `${header}
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  ${guard}
  dst[i] = select(0.0, 255.0, src[i] > ${THRESHOLD});
}`;

const SOBEL = /* wgsl */ `${header}
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;

fn at(x: i32, y: i32) -> f32 {
  let xx = u32(clamp(x, 0, i32(params.width) - 1));
  let yy = u32(clamp(y, 0, i32(params.height) - 1));
  return src[idx(xx, yy)];
}

@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  ${guard}
  let x = i32(gid.x); let y = i32(gid.y);
  let gx = -at(x-1,y-1) + at(x+1,y-1) - 2.0*at(x-1,y) + 2.0*at(x+1,y) - at(x-1,y+1) + at(x+1,y+1);
  let gy = -at(x-1,y-1) - 2.0*at(x,y-1) - at(x+1,y-1) + at(x-1,y+1) + 2.0*at(x,y+1) + at(x+1,y+1);
  dst[i] = min(255.0, sqrt(gx*gx + gy*gy));
}`;

export type GpuContext = {
  device: GPUDevice;
  adapterName: string;
};

export async function initGPU(): Promise<GpuContext | null> {
  if (!("gpu" in navigator)) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const info = adapter.info;
    const adapterName =
      [info?.description, info?.device, info?.vendor, info?.architecture]
        .find((s) => s && s.length > 2) ?? "GPU (name withheld by browser)";
    return { device, adapterName };
  } catch {
    return null;
  }
}

type Pass = { pipeline: GPUComputePipeline; bindGroup: GPUBindGroup };

export type GpuTaskInstance = {
  /** Encode `n` back-to-back iterations into one command buffer and submit. */
  run: (n: number) => Promise<void>;
  /** Read the output buffer back for verification against the CPU result. */
  readback: () => Promise<Float32Array | Uint32Array>;
  outKind: "f32" | "u32";
  destroy: () => void;
};

export function createGpuTask(
  ctx: GpuContext,
  task: string,
  rgba: Uint8ClampedArray,
  gray: Float32Array,
  width: number,
  height: number
): GpuTaskInstance {
  const { device } = ctx;
  const pixels = width * height;
  const buffers: GPUBuffer[] = [];

  const makeBuffer = (size: number, usage: GPUBufferUsageFlags) => {
    const b = device.createBuffer({ size, usage });
    buffers.push(b);
    return b;
  };

  const params = makeBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  device.queue.writeBuffer(params, 0, new Uint32Array([width, height]));

  const upload = (data: ArrayBufferView & { byteLength: number }) => {
    const b = makeBuffer(
      data.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    device.queue.writeBuffer(b, 0, data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
    return b;
  };

  const outBuffer = (bytes: number) =>
    makeBuffer(bytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);

  const makePass = (code: string, input: GPUBuffer, output: GPUBuffer): Pass => {
    const module = device.createShaderModule({ code });
    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: params } },
        { binding: 1, resource: { buffer: input } },
        { binding: 2, resource: { buffer: output } },
      ],
    });
    return { pipeline, bindGroup };
  };

  let passes: Pass[];
  let out: GPUBuffer;
  let outKind: "f32" | "u32" = "f32";

  switch (task) {
    case "grayscale": {
      const src = upload(new Uint32Array(rgba.buffer.slice(0)));
      out = outBuffer(pixels * 4);
      passes = [makePass(GRAYSCALE, src, out)];
      break;
    }
    case "invert": {
      const src = upload(new Uint32Array(rgba.buffer.slice(0)));
      out = outBuffer(pixels * 4);
      outKind = "u32";
      passes = [makePass(INVERT, src, out)];
      break;
    }
    case "gaussian_blur": {
      const src = upload(gray);
      const tmp = outBuffer(pixels * 4);
      out = outBuffer(pixels * 4);
      const { horizontal, vertical } = gaussSource();
      passes = [makePass(horizontal, src, tmp), makePass(vertical, tmp, out)];
      break;
    }
    case "threshold": {
      const src = upload(gray);
      out = outBuffer(pixels * 4);
      passes = [makePass(THRESHOLD_SRC, src, out)];
      break;
    }
    case "sobel": {
      const src = upload(gray);
      out = outBuffer(pixels * 4);
      passes = [makePass(SOBEL, src, out)];
      break;
    }
    default:
      throw new Error(`unknown GPU task: ${task}`);
  }

  const wgX = Math.ceil(width / WG);
  const wgY = Math.ceil(height / WG);

  const run = async (n: number) => {
    const encoder = device.createCommandEncoder();
    for (let i = 0; i < n; i++) {
      for (const p of passes) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(p.pipeline);
        pass.setBindGroup(0, p.bindGroup);
        pass.dispatchWorkgroups(wgX, wgY);
        pass.end();
      }
    }
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
  };

  const readback = async () => {
    const staging = makeBuffer(
      pixels * 4,
      GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    );
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(out, 0, staging, 0, pixels * 4);
    device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const copy = staging.getMappedRange().slice(0);
    staging.unmap();
    return outKind === "f32" ? new Float32Array(copy) : new Uint32Array(copy);
  };

  const destroy = () => buffers.forEach((b) => b.destroy());

  return { run, readback, outKind, destroy };
}
