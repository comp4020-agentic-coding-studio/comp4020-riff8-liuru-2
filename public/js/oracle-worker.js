// Runs the second orb's model off the page's main thread. Each worker loads
// exactly one configuration: the runtime remembers a backend that failed to
// start, so the page tries the next candidate in a fresh worker, terminating
// this one (and everything it allocated) first. One request at a time.

import { env, pipeline } from "/vendor/transformers/transformers.min.js";

env.allowLocalModels = false;
// the runtime's WebAssembly comes from this site, not a CDN
env.backends.onnx.wasm.wasmPaths = {
  mjs: "/vendor/ort/ort-wasm-simd-threaded.asyncify.mjs",
  wasm: "/vendor/ort/ort-wasm-simd-threaded.asyncify.wasm",
};
// threads only exist when the page is cross-origin isolated (the server sends the headers)
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let generator = null;

const looksLikeOom = (err) => /out of memory|allocation failed|memory access out of bounds|RangeError|OOM/i.test(String(err?.message ?? err));

async function release() {
  if (!generator) return;
  try {
    await generator.dispose();
  } catch {
    // already gone
  }
  generator = null;
}

async function load({ model, candidate }) {
  const started = performance.now();
  const files = new Map();
  try {
    generator = await pipeline("text-generation", model.id, {
      revision: model.revision,
      device: candidate.device,
      dtype: candidate.dtype,
      // the repo names some variants (model_q4f32.onnx) outside the runtime's own dtype suffixes
      model_file_name: candidate.file,
      progress_callback: (p) => {
        if (p.status !== "progress" || !p.total) return;
        files.set(p.file, [p.loaded, p.total]);
        let have = 0;
        let total = 0;
        for (const [l, t] of files.values()) {
          have += l;
          total += t;
        }
        postMessage({ type: "progress", loaded: have, total });
      },
    });
    postMessage({ type: "ready", ms: Math.round(performance.now() - started) });
  } catch (err) {
    await release();
    postMessage({ type: "loadFailed", message: String(err?.message ?? err).slice(0, 240), oom: looksLikeOom(err) });
  }
}

async function generate({ id, system, user, maxNewTokens, temperature, topP, topK, repetitionPenalty }) {
  if (!generator) {
    postMessage({ type: "failed", id, message: "no model loaded" });
    return;
  }
  const started = performance.now();
  try {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    const prompt = generator.tokenizer.apply_chat_template(messages, { add_generation_prompt: true, tokenize: false });
    const inputTokens = generator.tokenizer.encode(prompt, { add_special_tokens: false }).length;
    const [out] = await generator(messages, {
      max_new_tokens: maxNewTokens,
      do_sample: true,
      temperature,
      top_p: topP,
      top_k: topK,
      repetition_penalty: repetitionPenalty,
    });
    const reply = out.generated_text.at(-1);
    const text = typeof reply === "string" ? reply : (reply?.content ?? "");
    const outputTokens = generator.tokenizer.encode(text, { add_special_tokens: false }).length;
    postMessage({ type: "result", id, text, ms: Math.round(performance.now() - started), inputTokens, outputTokens });
  } catch (err) {
    postMessage({ type: "failed", id, message: String(err?.message ?? err).slice(0, 200), oom: looksLikeOom(err) });
  }
}

// one request at a time, in the order they came
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(() => {
    if (data.type === "load") return load(data);
    if (data.type === "generate") return generate(data);
    if (data.type === "release") return release().then(() => postMessage({ type: "released" }));
  });
};
