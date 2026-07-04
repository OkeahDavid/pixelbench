# pixelbench

[![PyPI](https://img.shields.io/pypi/v/pixelbench)](https://pypi.org/project/pixelbench/)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue)](https://pypi.org/project/pixelbench/)
[![Tests](https://img.shields.io/github/actions/workflow/status/OkeahDavid/pixelbench/ci.yml?branch=main&label=tests)](https://github.com/OkeahDavid/pixelbench/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/OkeahDavid/pixelbench)](https://github.com/OkeahDavid/pixelbench/blob/main/LICENSE)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fpixelbench.netlify.app&label=pixelbench.netlify.app)](https://pixelbench.netlify.app/)
[![GitHub stars](https://img.shields.io/github/stars/OkeahDavid/pixelbench?style=social)](https://github.com/OkeahDavid/pixelbench/stargazers)

**Speedtest for your CPU vs GPU — find out if GPU acceleration is actually
worth it on your machine.**

pixelbench runs identical image-processing workloads (blur, threshold, edge
detection, and more) on your CPU and your GPU, then shows you exactly where the
GPU wins and where it embarrassingly loses. No CUDA required — it uses OpenCV's
OpenCL backend, so it works on integrated Intel/AMD graphics, NVIDIA, and Apple
machines alike.

> **Reality check.** "GPUs are faster at image processing" is a half-truth.
> On the laptop this tool was born on (i5-12450H + Intel UHD graphics), the GPU
> is **4.6x faster** at bilateral filtering — and **26% slower** at a 4K
> Gaussian blur. Whether the GPU wins depends on the task, the image size, and
> your hardware. That's the whole point of measuring.

This project grew out of my bachelor's thesis at Kharkiv National University of
Radio Electronics: *"Computer Vision and the Effect of Hardware on the
Performance of Image Processing Tasks."*

---

## Try it in your browser

**[pixelbench.netlify.app](https://pixelbench.netlify.app)** — the `web/`
folder contains **pixelbench-web**, the same comparison with no
install: the CPU pass runs single-threaded TypeScript over typed arrays, the
GPU pass runs **WebGPU compute shaders (WGSL)**, and every GPU result is
verified against the CPU output before it is reported.

- Built with React + TypeScript + Vite; React Router for pages
  (benchmark + full methodology writeup)
- Dark instrument-style UI: CPU/GPU comparison bars per operation,
  JetBrains Mono numerals, summary stat panel, JSON export
- Deploys to Netlify as a static site (`netlify.toml` handles base,
  build, and the SPA redirect)

```bash
cd web
npm install
npm run dev
```

Note the two tools answer different questions: the CLI measures *native*
performance (OpenCV + OpenCL), the web version measures the *browser stack*
(JS vs WebGPU). Same machine, different stories — on the laptop this was
built on, the GPU wins 10/10 in the browser but only 18/24 natively, because
single-threaded JavaScript is a much softer baseline than OpenCV's
hand-optimized C++.

## Sample output

```
CPU: 12th Gen Intel(R) Core(TM) i5-12450H (12 threads)   GPU: Intel(R) UHD Graphics
Windows 11 · Python 3.12 · OpenCV 5.0 · median of 20 runs, 5 warmup

1080p
┌──────────────────────┬──────────┬──────────┬─────────────┐
│ Task                 │ CPU (ms) │ GPU (ms) │ GPU speedup │
├──────────────────────┼──────────┼──────────┼─────────────┤
│ Grayscale conversion │     0.97 │     0.58 │       1.67x │
│ Gaussian blur 15x15  │     4.92 │     5.14 │       0.96x │
│ Median blur 5x5      │     9.04 │     4.23 │       2.14x │
│ Bilateral filter d=9 │    44.49 │     9.62 │       4.63x │
│ Binary threshold     │     0.98 │     0.16 │       5.95x │
│ Sobel edges          │     1.53 │     0.64 │       2.38x │
│ Canny edges          │     5.06 │     1.87 │       2.71x │
│ Resize to 50%        │     0.61 │     0.52 │       1.16x │
└──────────────────────┴──────────┴──────────┴─────────────┘

Verdict: GPU won 18/24 tasks on this machine. Faster hardware isn't
always faster — it depends on the task and image size.
```

## Install & run

Run it directly from [PyPI](https://pypi.org/project/pixelbench/) — no clone,
no install ([uv](https://docs.astral.sh/uv/) required):

```bash
uvx pixelbench
```

Or with pip: `pip install pixelbench` then `pixelbench`.

To hack on it, clone and run:

```bash
git clone https://github.com/OkeahDavid/pixelbench
cd pixelbench
uv run pixelbench
```

To install `pixelbench` as a permanent command: `uv tool install pixelbench`

### Options

```
pixelbench --sizes 720p,1080p,1440p,4k   # image sizes to test
           --tasks gaussian_blur,canny   # subset of tasks (default: all 8)
           --iterations 50               # timed runs per op (default: 20)
           --no-gpu                      # CPU-only pass
           --json results/mine.json      # save machine-readable results
           --leaderboard                 # print a row for the table below
```

## Leaderboard

Run `pixelbench --leaderboard` and open a PR (or an issue) with your row —
laptops, desktops, potatoes, and workstations all welcome. Median speedup is
across all tasks and sizes.

| CPU | GPU | OS | Median GPU speedup | Best win |
|-----|-----|----|--------------------|----------|
| 12th Gen Intel(R) Core(TM) i5-12450H | Intel(R) UHD Graphics | Windows | 1.90x | 5.95x (Binary threshold, 1080p) |

## Methodology (the fine print that makes numbers honest)

- **Same code path, two backends.** Every task calls the same OpenCV function;
  the CPU pass gets a numpy array, the GPU pass gets a `cv2.UMat`, which routes
  through OpenCV's transparent OpenCL API.
- **Transfer excluded.** The test image is uploaded to the GPU *before* timing
  starts. Numbers measure compute, not PCIe/RAM copies. (A transfer-inclusive
  mode is on the roadmap — for one-shot processing it changes the story.)
- **Warmup runs** precede every measurement, because OpenCL compiles kernels on
  first use and that spike shouldn't pollute your numbers.
- **Median, not mean.** Each iteration is timed individually and the median is
  reported, so a background Windows update can't skew your results.
- **`cv2.ocl.finish()` after every GPU op**, so asynchronous work can't leak
  outside the timing window.
- **Deterministic test image.** A synthetic photo-like image (gradients +
  shapes + noise, fixed seed) is generated per size — every machine benchmarks
  the exact same pixels.

## Roadmap

- [x] CUDA backend — detected automatically on CUDA-enabled OpenCV builds
      with an NVIDIA GPU; adds a third comparison column (CPU vs OpenCL vs
      CUDA). The standard `opencv-python` wheel does not include CUDA.
- [ ] Transfer-inclusive timing mode (`--include-transfer`)
- [ ] Speedup charts (`--chart`, matplotlib)
- [ ] Hosted leaderboard with auto-submit

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE)
file for details.
