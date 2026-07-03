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
    <dl className="env">
      <div className="env-item">
        <dt>Logical cores</dt>
        <dd>{navigator.hardwareConcurrency ?? "—"}</dd>
      </div>
      <div className="env-item">
        <dt>GPU adapter</dt>
        <dd>
          {!gpuChecked ? "Detecting…" : gpu ? gpu.adapterName : "Not available"}
        </dd>
      </div>
      <div className="env-item">
        <dt>Browser</dt>
        <dd>{browserName()}</dd>
      </div>
    </dl>
  );
}
