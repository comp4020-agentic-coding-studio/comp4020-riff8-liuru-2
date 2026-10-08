# 0003: the model runs in the visitor's browser, one stream per browser

Status: accepted (crit 9 riff). Adds the second orb that the riff's brief
asks for; changes nothing about how human thoughts are posted or stored.

## Context

The brief wants a second crystal ball that keeps generating short thoughts
from the human ones, using a real model (LiquidAI's LFM2.5-230M as the first
candidate) chosen and quantised to fit the memory it actually has. The app
deploys to one Fly machine with 256 MB, which also runs the guestbook.

## What was measured

All on this development machine (48 cores), 8 October 2026.

| Configuration | Where | Measured |
| --- | --- | --- |
| LFM2.5-230M Q4_0 GGUF (QAD), llama.cpp via node-llama-cpp 3.22.1 | Node | 434 MB RSS after one generation, 235 MB of it anonymous (llama.cpp repacks Q4_0 into a second copy); ~300 ms per line |
| Same, Q8_0 GGUF | Node | 442 MB RSS; ~450 ms per line |
| LFM2.5-230M ONNX `q4`, transformers.js 4.3.1, WebAssembly | Chrome 154 | fails to load: no CPU kernel for `GatherBlockQuantized` (the 4-bit embeddings) |
| ONNX `q4f32` (4-bit layers, 32-bit embeddings), WebAssembly, 4 threads | Chrome 154 | 408 MB download; renderer 1.9–2.0 GB at peak while loading, 1.4 GB steady; 1.4–2.8 s per thought |
| ONNX `q8`, WebAssembly, 4 threads | Chrome 154 | 489 MB download; renderer peak 1.56 GB; 6–13 s per thought, and in 16 generations the same line came back five times |
| ONNX `q4`, WebGPU | Chrome 154, SwiftShader (software GPU) | 216 MB download; loads and generates; renderer 0.66 GB plus GPU process; 25–58 s per thought, which says nothing about a real GPU |
| `q4f32`, WebAssembly, an 8-minute soak | Chrome 154 | 62 generations and 11 compactions; renderer 1.6–1.86 GB with no upward trend; 568–597 DOM nodes; stored memory at most 3.5 KB |
| The deployed server image | Docker, `--memory=256m` | 44 MiB while serving and passing the spec |

## Decision

- **The model runs in the browser.** Neither GGUF fits comfortably beside
  the guestbook in 256 MB, and nothing else small enough would be worth
  hearing from. In the browser, the server stays at 44 MiB and the model
  gets whatever the visitor's device has. The weights come from Hugging Face
  at a pinned revision (`c6f46e4…`) and are cached by the browser; nothing
  is committed or served from here except the runtime's own JS and
  WebAssembly (`/vendor/`, from the installed package).
- **Candidates, in order:** `q4` on WebGPU when the browser offers an
  adapter, then `q4f32` on WebAssembly (over `q8`, which held less memory
  at its peak but was three times slower and repeated itself) when the device reports at least
  4 GB (or doesn't say). Each is tried in a fresh worker, and a failed one is
  terminated before the next starts, because onnxruntime-web remembers a
  backend that failed to start and refuses the next in the same worker. An
  out-of-memory error during generation falls to the next candidate the
  same way, keeping every thought so far. With no candidate left, the glass
  says it can't run here and the guestbook carries on.
- **When it wakes:** by itself when the orbs come into view, unless the
  pointer is coarse or the connection asks to save data; then it waits for a
  "wake it" button that names the download size. Already-cached weights
  always wake by themselves.
- **One stream per browser, not per site.** The memory lives in this
  browser's `localStorage`, never on the server and never in the human
  table. A Web Lock allows one generator across the browser's tabs; other
  tabs show its thoughts as storage changes. A tab out of sight for 30 s
  releases the model and the lock, and only tabs in view queue for it.
- **Bounds** (`public/js/oracle-memory.js`, `LIMITS`): 8 recent thoughts of
  at most 160 characters; a summary of at most 360 characters; 6 human
  comments of at most 200 characters per prompt, 2 of them reserved for
  comments it hasn't read; a 2,000-character prompt (about 500 tokens, well
  inside the model's 32k context); 40 new tokens per thought and 72 per
  summary. When the ring passes 8, the oldest 4 are folded into the summary
  by the model; a missing, junk or over-long summary is replaced by a
  deterministic one. Every fourth generation reads a single human comment
  with no model thoughts in the prompt, so the loop keeps returning to what
  people wrote.
- **Schedule:** one generation in flight, 4 s between completed ones, back-
  off of 2, 4, 8, 16 and 32 s after failures, and a stop after six in a row.
  A new human comment cuts the current rest short.

## Alternatives weighed

- **The GGUF on the server, in a child process.** One shared stream for the
  whole classroom is the more natural reading of "a neighbouring orb", and an
  out-of-memory kill would take only the child. But 434 MB doesn't go into
  256 MB, and raising the machine is outside the course setup.
- **A smaller model on the server.** Something around 100 MB might squeeze
  in, but a 135M-parameter model's lines would be noise, and the margin
  would be gone.
- **A hosted inference API.** Needs a credential and a paid service, which
  the brief rules out.

## Cost

Every visitor downloads 216 or 408 MB the first time, and the WebAssembly
path holds 1.4–2 GB of memory while it runs. That is why phones are asked
first. Two people in the same room see different streams.

The model card warns that this model is not built for creative writing, and
it shows. The first prompt asked for abstract moves ("a quiet contrast
between two of them"), which the model echoed back as labels; in 13 real
generations 8 were set aside. Two other framings and a few-shot version
(which set off "Here's your new line!" chatter) did no better. The prompt it
runs now asks for concrete things (a sound or a smell, something you could
touch, a question nobody has asked), and in a 16-generation run with the
real cleaning and de-duplication, 13 lines were kept: short sensory images
such as "A faint electric hum drifting from forgotten wires through cracked
windows", along with some that are only generic. The 3 set aside were a
refusal, a one-word reply and a near-repeat. Each thought took 1.7–4.5 s on
the WebAssembly path.

The licence (LFM Open License v1.0) allows this use; the repo doesn't
redistribute the weights.
