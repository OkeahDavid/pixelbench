import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  detectAdapterOptions,
  initGPU,
  type AdapterOption,
  type GpuContext,
  type GpuPreference,
} from "../bench/gpu";
import { runBenchmark, type Measurement } from "../bench/runner";
import { SIZES } from "../bench/image";
import { EnvCard } from "../components/EnvCard";
import { ResultsTable } from "../components/ResultsTable";

type Phase = "idle" | "running" | "done";

export function Benchmark() {
  const [gpu, setGpu] = useState<GpuContext | null>(null);
  const [gpuChecked, setGpuChecked] = useState(false);
  const [adapterOptions, setAdapterOptions] = useState<AdapterOption[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(["720p", "1080p"]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<Measurement[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const options = await detectAdapterOptions();
      const ctx = await initGPU(options[0]?.preference ?? "high-performance");
      if (cancelled) {
        ctx?.device.destroy();
        return;
      }
      setAdapterOptions(options);
      setGpu(ctx);
      setGpuChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectGpu = async (preference: GpuPreference) => {
    if (phase === "running" || gpu?.preference === preference) return;
    setGpuChecked(false);
    gpu?.device.destroy();
    const ctx = await initGPU(preference);
    setGpu(ctx);
    setGpuChecked(true);
  };

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
    const wins = withGpu.filter((m) => m.speedup! > 1).length;
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
            gpuPreference: gpu?.preference ?? null,
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
    <>
      <header>
        <p className="lede">
          A CPU and GPU benchmark for image processing, run in the browser.
        </p>
        <p className="description">
          Each operation is implemented twice: single-threaded JavaScript over
          typed arrays on the <span className="k-cpu">CPU</span>, and WebGPU
          compute shaders on the <span className="k-gpu">GPU</span>. Both
          process the same test image with the same parameters, and every GPU
          result is verified against the CPU output before it is reported. See{" "}
          <Link to="/methodology">methodology</Link> for details.
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
        <div className="size-picker" role="group" aria-label="Image sizes">
          <span className="control-label">Image sizes</span>
          <div className="pills">
            {Object.keys(SIZES).map((size) => (
              <button
                key={size}
                type="button"
                className="pill"
                aria-pressed={selectedSizes.includes(size)}
                disabled={phase === "running"}
                onClick={() => toggleSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        {adapterOptions.length > 1 && (
          <div className="size-picker" role="group" aria-label="GPU adapter">
            <span className="control-label">GPU</span>
            <div className="pills">
              {adapterOptions.map((option) => (
                <button
                  key={option.preference}
                  type="button"
                  className="pill"
                  aria-pressed={gpu?.preference === option.preference}
                  disabled={phase === "running" || !gpuChecked}
                  title={option.preference}
                  onClick={() => selectGpu(option.preference)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          className="primary"
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
            <div className="stat">
              <div className="stat-value">
                {summary.wins}
                <span className="stat-dim">/{summary.total}</span>
              </div>
              <div className="stat-label">GPU faster</div>
            </div>
            <div className="stat">
              <div className="stat-value">{summary.median.toFixed(2)}×</div>
              <div className="stat-label">Median speedup</div>
            </div>
            <div className="stat">
              <div className="stat-value">{summary.best.speedup!.toFixed(2)}×</div>
              <div className="stat-label">
                Peak — {summary.best.label}, {summary.best.size}
              </div>
            </div>
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
          <p className="summary-plain">
            Benchmark complete, CPU only. A WebGPU-capable browser is required
            for the GPU comparison.
          </p>
        </section>
      )}
    </>
  );
}
