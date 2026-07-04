import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="shell">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">
          pixelbench<span className="version">v{__APP_VERSION__}</span>
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end>
            Benchmark
          </NavLink>
          <NavLink to="/methodology">Methodology</NavLink>
          <NavLink to="/about">About</NavLink>
          <a
            href="https://github.com/OkeahDavid/pixelbench"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>
        <p className="fine">
          pixelbench-web measures the browser stack: JavaScript against WebGPU.
          For native measurements with OpenCV and OpenCL, use the{" "}
          <a href="https://github.com/OkeahDavid/pixelbench">pixelbench CLI</a>,
          available on{" "}
          <a href="https://pypi.org/project/pixelbench/">PyPI</a> (
          <code>uvx pixelbench</code>).
        </p>
        <p className="fine">
          <a href="https://github.com/OkeahDavid">Okeah David</a> ·{" "}
          <a href="https://github.com/OkeahDavid/pixelbench/blob/main/LICENSE">
            MIT license
          </a>
        </p>
      </footer>
    </div>
  );
}
