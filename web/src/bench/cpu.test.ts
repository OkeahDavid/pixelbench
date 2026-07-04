import { describe, expect, it } from "vitest";
import {
  gaussianBlur,
  grayscale,
  invert,
  sobel,
  threshold,
  type CpuInputs,
} from "./cpu";
import { gaussianKernel } from "./image";

/** Build CpuInputs from a solid color; gray is derived like toGrayFloat. */
function solidInputs(
  width: number,
  height: number,
  [r, g, b]: [number, number, number]
): CpuInputs {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const gray = new Float32Array(width * height);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
    gray[i] = luma;
  }
  return { rgba, gray, width, height };
}

describe("grayscale", () => {
  it("applies BT.601 luma weights", () => {
    const out = grayscale(solidInputs(4, 4, [255, 0, 0]));
    expect(out[0]).toBeCloseTo(0.299 * 255, 3);
  });

  it("maps white to 255 and black to 0", () => {
    expect(grayscale(solidInputs(2, 2, [255, 255, 255]))[0]).toBeCloseTo(255, 3);
    expect(grayscale(solidInputs(2, 2, [0, 0, 0]))[0]).toBe(0);
  });
});

describe("invert", () => {
  it("inverts channels and keeps alpha opaque", () => {
    const out = invert(solidInputs(2, 2, [10, 200, 255]));
    expect([out[0], out[1], out[2], out[3]]).toEqual([245, 55, 0, 255]);
  });
});

describe("threshold", () => {
  it("binarizes around 127", () => {
    const inputs = solidInputs(2, 2, [0, 0, 0]);
    inputs.gray = new Float32Array([0, 127, 128, 255]);
    const out = threshold(inputs);
    expect(Array.from(out)).toEqual([0, 0, 255, 255]);
  });
});

describe("sobel", () => {
  it("is zero on a flat image", () => {
    const out = sobel(solidInputs(8, 8, [90, 90, 90]));
    expect(Math.max(...out)).toBe(0);
  });

  it("responds to a vertical edge", () => {
    const inputs = solidInputs(8, 8, [0, 0, 0]);
    // left half 0, right half 255
    for (let y = 0; y < 8; y++)
      for (let x = 4; x < 8; x++) inputs.gray[y * 8 + x] = 255;
    const out = sobel(inputs);
    const edgeColumn = out[2 * 8 + 4];
    expect(edgeColumn).toBeGreaterThan(0);
  });
});

describe("gaussianBlur", () => {
  it("preserves a constant image (kernel is normalized, edges clamped)", () => {
    const out = gaussianBlur(solidInputs(16, 16, [100, 100, 100]));
    const gray = 0.299 * 100 + 0.587 * 100 + 0.114 * 100;
    for (const v of out) expect(v).toBeCloseTo(gray, 3);
  });

  it("smooths an impulse without changing total mass", () => {
    const inputs = solidInputs(17, 17, [0, 0, 0]);
    inputs.gray[8 * 17 + 8] = 1000;
    const out = gaussianBlur(inputs);
    const peak = out[8 * 17 + 8];
    expect(peak).toBeLessThan(1000);
    expect(peak).toBeGreaterThan(0);
    const sum = out.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1000, 0);
  });
});

describe("gaussianKernel", () => {
  it("is normalized and symmetric", () => {
    const k = gaussianKernel(4, 2.0);
    expect(k.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(k[0]).toBeCloseTo(k[8], 6);
    expect(k[4]).toBeGreaterThan(k[0]);
  });
});
