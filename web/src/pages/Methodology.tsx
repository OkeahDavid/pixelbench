import { Link } from "react-router-dom";
import {
  GAUSS_RADIUS,
  GAUSS_SIGMA,
  SIZES,
  THRESHOLD,
} from "../bench/image";
import { TASK_LABELS } from "../bench/runner";

export function Methodology() {
  return (
    <article className="prose">
      <header>
        <p className="lede">Methodology</p>
        <p className="description">
          What pixelbench measures, how it measures it, and where the numbers
          should and should not be trusted.
        </p>
      </header>

      <section>
        <h2>What is compared</h2>
        <p>
          Every operation has two implementations that receive identical input
          and parameters:
        </p>
        <ul>
          <li>
            <span className="k-cpu">CPU</span> — single-threaded JavaScript
            over typed arrays (<code>Uint8ClampedArray</code>,{" "}
            <code>Float32Array</code>), running on the main thread.
          </li>
          <li>
            <span className="k-gpu">GPU</span> — WebGPU compute shaders
            written in WGSL, dispatched one thread per pixel in 8×8
            workgroups.
          </li>
        </ul>
        <p>
          The Gaussian kernel weights are computed once in JavaScript and
          injected into the WGSL source, so both backends execute literally
          the same coefficients.
        </p>
      </section>

      <section>
        <h2>Operations</h2>
        <ul>
          <li>
            {TASK_LABELS.grayscale} — BT.601 luma weights (0.299, 0.587,
            0.114)
          </li>
          <li>{TASK_LABELS.invert} — 255 − v per channel</li>
          <li>
            {TASK_LABELS.gaussian_blur} — separable, radius {GAUSS_RADIUS},
            σ = {GAUSS_SIGMA}, clamped edges, two passes per iteration
          </li>
          <li>
            {TASK_LABELS.threshold} — binary at {THRESHOLD} on the grayscale
            image
          </li>
          <li>
            {TASK_LABELS.sobel} — 3×3 kernels, gradient magnitude clamped to
            255
          </li>
        </ul>
        <p>
          Available image sizes:{" "}
          {Object.entries(SIZES)
            .map(([name, [w, h]]) => `${name} (${w}×${h})`)
            .join(", ")}
          .
        </p>
      </section>

      <section>
        <h2>Test image</h2>
        <p>
          The input is generated, not loaded: a diagonal gradient, forty
          pseudo-random circles, and per-pixel noise, drawn with a seeded
          PRNG (mulberry32, seed 42). This gives the filters both flat
          regions and hard edges, and guarantees that every machine — and
          every run — processes the same pixels.
        </p>
      </section>

      <section>
        <h2>Timing</h2>
        <ul>
          <li>
            Inputs are prepared and uploaded to GPU buffers before timing
            starts. The numbers measure compute, not transfer.
          </li>
          <li>
            Warmup runs precede every measurement: they trigger JIT
            compilation on the CPU side and pipeline/driver warmup on the GPU
            side.
          </li>
          <li>
            Iteration counts adapt to the cost of each operation, targeting
            roughly 400 ms of measured work within 5–30 samples.
          </li>
          <li>
            The reported time is the median of individually timed samples,
            which is robust against scheduler interruptions.
          </li>
          <li>
            GPU samples batch several dispatches into one submission and
            divide by the batch size, because a single dispatch is shorter
            than the submission overhead itself. Completion is awaited with{" "}
            <code>onSubmittedWorkDone</code>.
          </li>
        </ul>
      </section>

      <section>
        <h2>Verification</h2>
        <p>
          After timing, the GPU output buffer is read back and compared
          against the CPU result on a deterministic sample of pixels with a
          tolerance of 1.5 (32-bit and 64-bit float accumulation order
          differ). A result only counts if the outputs match; mismatches are
          flagged in the results.
        </p>
      </section>

      <section>
        <h2>Limitations</h2>
        <ul>
          <li>
            This measures the <em>browser</em> stack. Single-threaded
            JavaScript is a much softer baseline than native SIMD-optimized
            code, so GPU speedups here are larger than what the{" "}
            <a href="https://github.com/OkeahDavid/pixelbench">
              native CLI
            </a>{" "}
            reports on the same machine.
          </li>
          <li>
            <code>performance.now()</code> is coarsened by browsers unless
            the page is cross-origin isolated. At the millisecond scale of
            these operations the effect is negligible, but sub-0.1 ms
            readings should be treated as approximate.
          </li>
          <li>
            Integrated GPUs share memory bandwidth and thermal headroom with
            the CPU; results vary a few percent run to run, and more under
            load or on battery.
          </li>
          <li>
            Browsers deliberately mask the exact GPU adapter name, so the
            reported adapter may be generic.
          </li>
        </ul>
      </section>

      <p className="prose-back">
        <Link to="/">Back to the benchmark</Link>
      </p>
    </article>
  );
}
