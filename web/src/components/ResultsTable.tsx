import type { Measurement } from "../bench/runner";

function SpeedupCell({ m }: { m: Measurement }) {
  if (m.gpuError) return <td className="muted">Unsupported</td>;
  if (m.speedup === null) return <td className="muted">—</td>;
  const cls = m.speedup >= 1.1 ? "gain" : m.speedup <= 0.9 ? "loss" : "";
  return <td className={cls}>{m.speedup.toFixed(2)}×</td>;
}

export function ResultsTable({ size, rows }: { size: string; rows: Measurement[] }) {
  return (
    <section className="results">
      <h2>{size}</h2>
      <table>
        <thead>
          <tr>
            <th>Operation</th>
            <th>CPU</th>
            <th>GPU</th>
            <th>Speedup</th>
            <th>Verified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.task}>
              <td>{m.label}</td>
              <td>{m.cpuMs.toFixed(2)} ms</td>
              <td>{m.gpuMs !== null ? `${m.gpuMs.toFixed(2)} ms` : "—"}</td>
              <SpeedupCell m={m} />
              <td>
                {m.verified === null ? (
                  <span className="muted">—</span>
                ) : m.verified ? (
                  "Yes"
                ) : (
                  <span className="loss">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
