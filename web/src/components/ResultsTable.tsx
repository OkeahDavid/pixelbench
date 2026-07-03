import type { Measurement } from "../bench/runner";

function Row({ m }: { m: Measurement }) {
  const max = Math.max(m.cpuMs, m.gpuMs ?? 0);
  const cpuPct = max > 0 ? (m.cpuMs / max) * 100 : 0;
  const gpuPct = m.gpuMs !== null && max > 0 ? (m.gpuMs / max) * 100 : 0;
  const gpuWon = m.speedup !== null && m.speedup > 1;

  return (
    <div className="row">
      <div className="row-label">{m.label}</div>
      <div className="row-bars">
        <div className="bar-line">
          <span className="bar-tag">CPU</span>
          <span className="bar-track">
            <span className="bar bar-cpu" style={{ width: `${cpuPct}%` }} />
          </span>
          <span className="bar-value">{m.cpuMs.toFixed(2)} ms</span>
        </div>
        <div className="bar-line">
          <span className="bar-tag">GPU</span>
          <span className="bar-track">
            {m.gpuMs !== null && (
              <span className="bar bar-gpu" style={{ width: `${gpuPct}%` }} />
            )}
          </span>
          <span className="bar-value">
            {m.gpuError ? "unsupported" : m.gpuMs !== null ? `${m.gpuMs.toFixed(2)} ms` : "—"}
          </span>
        </div>
      </div>
      <div className="row-speedup">
        {m.speedup !== null && (
          <span className={gpuWon ? "speedup gpu-won" : "speedup cpu-won"}>
            {m.speedup.toFixed(2)}×
          </span>
        )}
        {m.verified === false && <span className="mismatch">mismatch</span>}
      </div>
    </div>
  );
}

export function ResultsTable({ size, rows }: { size: string; rows: Measurement[] }) {
  const verified = rows.filter((m) => m.verified === true).length;
  const withGpu = rows.filter((m) => m.gpuMs !== null).length;
  return (
    <section className="results">
      <div className="results-head">
        <h2>{size}</h2>
        {withGpu > 0 && (
          <span className="verify-note">
            {verified}/{withGpu} outputs verified
          </span>
        )}
      </div>
      <div className="rows">
        {rows.map((m) => (
          <Row key={m.task} m={m} />
        ))}
      </div>
    </section>
  );
}
