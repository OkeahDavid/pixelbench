import { Link } from "react-router-dom";

export function About() {
  return (
    <article className="prose">
      <header>
        <p className="lede">About</p>
        <p className="description">
          Where this project comes from, and who builds it.
        </p>
      </header>

      <section>
        <h2>The project</h2>
        <p>
          pixelbench grew out of my bachelor&rsquo;s thesis at Kharkiv National
          University of Radio Electronics, <em>Computer Vision and the Effect
          of Hardware on the Performance of Image Processing Tasks</em>{" "}
          (Computer Engineering, 2022, supervised by Prof. Olesia Barkovska).
          The thesis measured how the same image-processing operations —
          grayscale conversion, blurring, binarization — perform on a CPU
          versus a GPU using Python and OpenCV.
        </p>
        <p>
          Its conclusion is easy to state and easy to over-simplify: GPUs are
          often faster, but not always, and not uniformly. Whether the GPU
          wins depends on the operation, the image size, and the hardware.
          pixelbench turns that finding into something you can test on your
          own machine instead of taking on faith.
        </p>
        <p>The project has two parts:</p>
        <ul>
          <li>
            a{" "}
            <a href="https://github.com/OkeahDavid/pixelbench">
              command-line tool
            </a>{" "}
            that benchmarks native performance with OpenCV, comparing the CPU
            against the GPU through OpenCL — no CUDA required, so it runs on
            integrated graphics too; and
          </li>
          <li>
            this site, which runs the same comparison in the browser:
            JavaScript on the CPU against WebGPU compute shaders on the GPU.
          </li>
        </ul>
        <p>
          The two report different numbers on the same machine, and that gap
          is itself the point: single-threaded JavaScript is a much softer
          baseline than OpenCV&rsquo;s optimized C++, so the browser flatters
          the GPU. The <Link to="/methodology">methodology</Link> page
          explains exactly what is measured and where to be skeptical.
        </p>
      </section>

      <section>
        <h2>The author</h2>
        <p>
          I&rsquo;m Okeah David Chidugam, a computer engineering graduate who
          builds software across the stack — web applications, machine
          learning systems, and developer tools. More of my work is on{" "}
          <a href="https://github.com/OkeahDavid">GitHub</a>.
        </p>
        <p>
          Found a bug, or benchmarked hardware with an interesting result?{" "}
          <a href="https://github.com/OkeahDavid/pixelbench/issues">
            Open an issue
          </a>{" "}
          — result submissions for the leaderboard are welcome.
        </p>
      </section>

      <p className="prose-back">
        <Link to="/">Back to the benchmark</Link>
      </p>
    </article>
  );
}
