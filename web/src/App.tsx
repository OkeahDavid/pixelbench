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

  const verdict = useMemo(() => {
    const withGpu = results.filter((m) => m.speedup !== null);
    if (!withGpu.length) return null;
    const wins = withGpu.filter((m) => m.speedup! > 1.1).length;
    const speedups = withGpu.map((m) => m.speedup!).sort((a, b) => a - b);
    const med = speedups[speedups.length >> 1];
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
        <h1>
          pixel<span className="accent">bench</span>
        </h1>
        <p className="tagline">
          Race your CPU against your GPU on real image-processing work — right
          here, right now.
        </p>
        <p className="sub">
          CPU pass runs plain JavaScript on typed arrays. GPU pass runs{" "}
          <strong>WebGPU compute shaders</strong>. Same pixels, same math, may
          the best silicon win.
        </p>
      </header>

      <EnvCard gpu={gpu} gpuChecked={gpuChecked} />

      {gpuChecked && !gpu && (
        <div className="warning">
          ⚠️ Your browser doesn't support WebGPU, so only the CPU pass will
          run. Try Chrome or Edge for the full race.
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
              {size === "4K" && <span className="hint"> (slower)</span>}
            </label>
          ))}
        </fieldset>
        <button
          onClick={run}
          disabled={phase === "running" || !gpuChecked || selectedSizes.length === 0}
        >
          {phase === "running" ? "Racing…" : "▶  Run benchmark"}
        </button>
      </section>

      {phase === "running" && (
        <div className="status">
          <div className="spinner" />
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

      {phase === "done" && verdict && (
        <>
          <div className="verdict">
            <strong>Verdict:</strong> GPU won {verdict.wins}/{verdict.total}{" "}
            tasks (median speedup {verdict.median.toFixed(2)}x, best{" "}
            {verdict.best.speedup!.toFixed(2)}x on {verdict.best.label} @{" "}
            {verdict.best.size}). Faster hardware isn't always faster — it
            depends on the task and the image size.
          </div>
          <div className="actions">
            <button className="ghost" onClick={downloadJson}>
              Download results (JSON)
            </button>
            <button className="ghost" onClick={run}>
              Run again
            </button>
          </div>
        </>
      )}

      {phase === "done" && !verdict && (
        <div className="verdict">
          CPU-only run complete. Open this page in a WebGPU-capable browser
          (Chrome/Edge) to let your GPU fight back.
        </div>
      )}

      <footer>
        <p>
          Want honest <em>native</em> numbers (OpenCV + OpenCL, no browser
          overhead)? Get the{" "}
          <a href="https://github.com/OkeahDavid/pixelbench">pixelbench CLI</a>.
        </p>
        <p className="fine">
          Methodology: deterministic synthetic test image · warmup before
          timing · median of individually timed samples · GPU timed via{" "}
          <code>onSubmittedWorkDone</code> with batched dispatches · GPU output
          verified against CPU output per task · transfers excluded. Built by{" "}
          <a href="https://github.com/OkeahDavid">Okeah David</a> · MIT
        </p>
      </footer>
    </main>
  );
}
