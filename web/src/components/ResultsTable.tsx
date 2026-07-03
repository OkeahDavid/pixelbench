import type { Measurement } from "../bench/runner";

function SpeedupCell({ m }: { m: Measurement }) {
  if (m.gpuError) return <td className="muted">unsupported</td>;
  if (m.speedup === null) return <td className="muted">—</td>;
  const cls =
    m.speedup >= 1.1 ? "speed-win" : m.speedup <= 0.9 ? "speed-lose" : "speed-tie";
  return <td className={cls}>{m.speedup.toFixed(2)}x</td>;
}

export function ResultsTable({ size, rows }: { size: string; rows: Measurement[] }) {
  return (
    <section className="size-block">
      <h2>{size}</h2>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>CPU (ms)</th>
            <th>GPU (ms)</th>
            <th>Speedup</th>
            <th>Match</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.task}>
              <td>{m.label}</td>
              <td>{m.cpuMs.toFixed(2)}</td>
              <td>{m.gpuMs !== null ? m.gpuMs.toFixed(2) : "—"}</td>
              <SpeedupCell m={m} />
              <td>
                {m.verified === null ? (
                  <span className="muted">—</span>
                ) : m.verified ? (
                  <span className="check">✓</span>
                ) : (
                  <span className="speed-lose">✗</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
