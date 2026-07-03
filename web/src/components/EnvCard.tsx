import type { GpuContext } from "../bench/gpu";

function browserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ""}`;
  if (ua.includes("Chrome/")) return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ""}`;
  if (ua.includes("Firefox/")) return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ""}`;
  if (ua.includes("Safari/")) return "Safari";
  return "Unknown";
}

export function EnvCard({
  gpu,
  gpuChecked,
}: {
  gpu: GpuContext | null;
  gpuChecked: boolean;
}) {
  return (
    <section className="env-card">
      <div className="env-item">
        <span className="env-label">CPU threads</span>
        <span>{navigator.hardwareConcurrency ?? "?"}</span>
      </div>
      <div className="env-item">
        <span className="env-label">GPU (WebGPU)</span>
        <span>
          {!gpuChecked ? "detecting…" : gpu ? gpu.adapterName : "not available"}
        </span>
      </div>
      <div className="env-item">
        <span className="env-label">Browser</span>
        <span>{browserName()}</span>
      </div>
    </section>
  );
}
