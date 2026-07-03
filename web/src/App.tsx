import { useEffect, useMemo, useState } from "react";
import { initGPU, type GpuContext } from "./bench/gpu";
import { runBenchmark, type Measurement } from "./bench/runner";
import { SIZES } from "./bench/image";
import { EnvCard } from "./components/EnvCard";
import { ResultsTable } from "./components/ResultsTable";

type Phase = "idle" | "running" | "done";

export default function App() {
  const [gpu, setGpu] = useState<GpuContext | null>(null);
  const [gpuChecked, setGpuChecked] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["720p", "1080p"]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<Measurement[]>([]);

  useEffect(() => {
    initGPU().then((ctx) => {
      setGpu(ctx);
      setGpuChecked(true);
    });
  }, []);

  const toggleSize = (size: string) =>
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );

  const run = async () => {
    setPhase("running");
    setResults([]);
    try {
      const ordered = Object.keys(SIZES).filter((s) => selectedSizes.includes(s));
      const measurements = await runBenchmark(ordered, gpu, setStatus);
      setResults(measurements);
      setPhase("done");
    } catch (e) {
      setStatus(`Benchmark failed: ${e instanceof Error ? e.message : e}`);
      setPhase("idle");
    }
  };

  const summary = useMemo(() => {
    const withGpu = results.filter((m) => m.speedup !== null);
    if (!withGpu.length) return null;
    const wins = withGpu.filter((m) => m.speedup! > 1.1).length;
    const speedups = withGpu.map((m) => m.speedup!).sort((a, b) => a - b);
    const mid = speedups.length >> 1;
    const med =
      speedups.length % 2 ? speedups[mid] : (speedups[mid - 1] + speedups[mid]) / 2;
    const best = withGpu.reduce((a, b) => (b.speedup! > a.speedup! ? b : a));
    return { wins, total: withGpu.length, median: med, best };
  }, [results]);

  const downloadJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            pixelbench_web: "0.1.0",
            timestamp: new Date().toISOString(),
            gpu: gpu?.adapterName ?? null,
            cpuThreads: navigator.hardwareConcurrency,
            userAgent: navigator.userAgent,
            results,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pixelbench-results.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sizeOrder = Object.keys(SIZES).filter((s) =>
    results.some((m) => m.size === s)
  );

  return (
    <main>
      <header>
        <h1>pixelbench</h1>
        <p className="lede">
          A CPU and GPU benchmark for image processing, run in the browser.
        </p>
        <p className="description">
          Each operation is implemented twice: single-threaded JavaScript over
          typed arrays on the CPU, and WebGPU compute shaders on the GPU. Both
          implementations process the same test image with the same parameters,
          and every GPU result is verified against the CPU output before it is
          reported.
        </p>
      </header>

      <EnvCard gpu={gpu} gpuChecked={gpuChecked} />

      {gpuChecked && !gpu && (
        <div className="notice" role="alert">
          WebGPU is not available in this browser, so the benchmark will run on
          the CPU only. Chrome and Edge currently support WebGPU.
        </div>
      )}

      <section className="controls">
        <fieldset disabled={phase === "running"}>
          <legend>Image sizes</legend>
          {Object.keys(SIZES).map((size) => (
            <label key={size}>
              <input
                type="checkbox"
                checked={selectedSizes.includes(size)}
                onChange={() => toggleSize(size)}
              />
              {size}
            </label>
          ))}
        </fieldset>
        <button
          onClick={run}
          disabled={phase === "running" || !gpuChecked || selectedSizes.length === 0}
        >
          {phase === "running" ? "Running…" : "Run benchmark"}
        </button>
      </section>

      {phase === "running" && (
        <div className="status" role="status">
          <div className="spinner" aria-hidden="true" />
          <span>{status}</span>
        </div>
      )}

      {sizeOrder.map((size) => (
        <ResultsTable
          key={size}
          size={size}
          rows={results.filter((m) => m.size === size)}
        />
      ))}

      {phase === "done" && summary && (
        <>
          <section className="summary">
            <h2>Summary</h2>
            <p>
              The GPU outperformed the CPU on {summary.wins} of {summary.total}{" "}
              measurements. Median speedup {summary.median.toFixed(2)}×; highest{" "}
              {summary.best.speedup!.toFixed(2)}× ({summary.best.label},{" "}
              {summary.best.size}).
            </p>
          </section>
          <div className="actions">
            <button className="secondary" onClick={downloadJson}>
              Download JSON
            </button>
            <button className="secondary" onClick={run}>
              Run again
            </button>
          </div>
        </>
      )}

      {phase === "done" && !summary && (
        <section className="summary">
          <h2>Summary</h2>
          <p>
            Benchmark complete, CPU only. A WebGPU-capable browser is required
            for the GPU comparison.
          </p>
        </section>
      )}

      <footer>
        <p>
          pixelbench-web measures the browser stack: JavaScript against WebGPU.
          For native measurements with OpenCV and OpenCL, use the{" "}
          <a href="https://github.com/OkeahDavid/pixelbench">pixelbench CLI</a>.
        </p>
        <p className="fine">
          Methodology: deterministic synthetic test image; warmup runs before
          timing; median of individually timed samples; GPU timed with{" "}
          <code>onSubmittedWorkDone</code> over batched dispatches; input
          transfers excluded; GPU output verified against CPU output per
          operation.
        </p>
        <p className="fine">
          <a href="https://github.com/OkeahDavid">Okeah David</a> · MIT license
        </p>
      </footer>
    </main>
  );
}
