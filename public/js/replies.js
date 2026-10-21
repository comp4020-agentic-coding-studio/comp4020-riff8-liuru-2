// Replies: one quiet, single-level thread under each human thought. The same
// thread view is mounted in two places (the reading panel under the orb, and
// the plain-text list), and both read from one store, so a reply that lands
// from anywhere updates every view of its thought without touching a draft.

import { relativeTime } from "./util.js";

const POST_TIMEOUT = 12_000;
const newRequest = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const repliesLabel = (n) => (n === 1 ? "1 reply" : `${n} replies`);

/**
 * @param {{
 *   maxText: number,
 *   announce: (message: string) => void,
 *   onComposeInPanel: (traceId: number | null) => void,
 * }} options
 */
export function createReplies({ maxText, announce, onComposeInPanel }) {
  const byTrace = new Map(); // traceId -> replies, oldest first
  const known = new Set();
  const sent = new Set(); // request ids this page has sent, so its own replies are recognised on the stream
  const drafts = new Map(); // traceId -> { text, request, sentText, pending, error }
  const views = new Set();
  const expanded = new Set(); // `${place}:${traceId}` of threads left open, kept across rebuilds
  let serial = 0;

  /** Stores a reply if it is new, returning it as stored; null when it was already here. */
  function add(reply) {
    if (known.has(reply.id)) return null;
    known.add(reply.id);
    if (reply.request && sent.has(reply.request)) reply = { ...reply, mine: true };
    const list = byTrace.get(reply.traceId) ?? [];
    list.push(reply);
    list.sort((a, b) => a.id - b.id);
    byTrace.set(reply.traceId, list);
    for (const v of views) if (v.traceId === reply.traceId) v.update(reply);
    return reply;
  }

  const count = (traceId) => byTrace.get(traceId)?.length ?? 0;

  function replyItem(r) {
    const li = document.createElement("li");
    li.className = `reply${r.mine ? " mine" : ""}`;
    li.dataset.id = r.id;
    const who = document.createElement("span");
    who.className = "reply-who";
    who.textContent = r.mine ? "you" : "anonymous";
    const text = document.createElement("span");
    text.className = "reply-text";
    text.textContent = r.text;
    const when = document.createElement("time");
    when.className = "when";
    when.dateTime = new Date(r.createdAt).toISOString();
    when.textContent = relativeTime(r.createdAt);
    li.append(who, text, when);
    return li;
  }

  /**
   * A thread for one thought, to put under it. `place` is "panel" or "list";
   * `parent` is the thought itself, quoted in the composer so the reply's
   * target is never in doubt.
   */
  function mount(parent, place) {
    const id = `t${++serial}`;
    const traceId = parent.id;
    const key = `${place}:${traceId}`;
    const root = document.createElement("div");
    root.className = `answers answers-${place}`;
    root.dataset.trace = traceId;

    const bar = document.createElement("div");
    bar.className = "answers-bar";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "answers-toggle";
    toggle.setAttribute("aria-controls", `${id}-list`);
    const none = document.createElement("span");
    none.className = "answers-none";
    none.textContent = "no replies yet";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "reply-open";
    open.setAttribute("aria-controls", `${id}-form`);
    open.setAttribute("aria-expanded", "false");
    open.innerHTML = '<span class="reply-open-mark" aria-hidden="true">↳</span> Reply';
    open.setAttribute("aria-label", `Reply to this ${parent.label ?? "thought"}`);
    bar.append(toggle, none, open);

    const list = document.createElement("ol");
    list.className = "replies";
    list.id = `${id}-list`;
    list.setAttribute("aria-label", "replies, oldest first");

    const form = document.createElement("form");
    form.className = "reply-form";
    form.id = `${id}-form`;
    form.hidden = true;
    form.noValidate = true;
    const to = document.createElement("p");
    to.className = "reply-to";
    to.id = `${id}-to`;
    const quote = document.createElement("q");
    quote.textContent = parent.text.length > 90 ? `${parent.text.slice(0, 88)}…` : parent.text;
    to.append("replying to ", quote);
    const label = document.createElement("label");
    label.htmlFor = `${id}-text`;
    label.className = "reply-label";
    label.textContent = "Your reply, left anonymously";
    const area = document.createElement("textarea");
    area.id = `${id}-text`;
    area.name = "text";
    area.rows = 2;
    area.maxLength = maxText;
    area.spellcheck = true;
    area.setAttribute("aria-describedby", `${id}-to ${id}-count ${id}-status`);
    const foot = document.createElement("div");
    foot.className = "reply-foot";
    const counter = document.createElement("span");
    counter.className = "reply-count";
    counter.id = `${id}-count`;
    const status = document.createElement("p");
    status.className = "reply-status";
    status.id = `${id}-status`;
    status.setAttribute("aria-live", "polite");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "reply-cancel";
    cancel.textContent = "Cancel";
    const send = document.createElement("button");
    send.type = "submit";
    send.className = "reply-send";
    send.textContent = "Send reply";
    foot.append(counter, cancel, send);
    form.append(to, label, area, foot, status);

    root.append(bar, list, form);

    const draft = () => drafts.get(traceId);
    const view = { traceId, place, root, update, close, dispose, get open() { return !form.hidden; } };

    function renderCount() {
      const n = area.value.length;
      counter.textContent = `${n} of ${maxText} characters`;
      counter.classList.toggle("near", n >= maxText - 40);
    }

    function setStatus(message, error = false) {
      status.textContent = message;
      status.classList.toggle("error", error);
      area.setAttribute("aria-invalid", String(error));
    }

    function renderPending() {
      const d = draft();
      const pending = Boolean(d?.pending);
      send.setAttribute("aria-disabled", String(pending));
      cancel.disabled = pending;
      area.readOnly = pending;
      send.textContent = pending ? "Sending…" : d?.error ? "Try again" : "Send reply";
      root.classList.toggle("sending", pending);
    }

    function setExpanded(on) {
      if (on) expanded.add(key);
      else expanded.delete(key);
      list.hidden = !on;
      toggle.setAttribute("aria-expanded", String(on));
      root.classList.toggle("expanded", on);
    }

    function update(fresh = null) {
      const replies = byTrace.get(traceId) ?? [];
      const n = replies.length;
      toggle.hidden = n === 0;
      none.hidden = n > 0;
      toggle.innerHTML = "";
      const chevron = document.createElement("span");
      chevron.className = "answers-chevron";
      chevron.setAttribute("aria-hidden", "true");
      toggle.append(chevron, repliesLabel(n));
      // add only what is new, so whatever a reader has focused or scrolled to stays put
      const have = new Set([...list.children].map((li) => Number(li.dataset.id)));
      for (const r of replies) {
        if (have.has(r.id)) continue;
        const li = replyItem(r);
        if (fresh?.id === r.id) li.classList.add("arrived");
        const after = [...list.children].find((x) => Number(x.dataset.id) > r.id);
        list.insertBefore(li, after ?? null);
      }
      if (n === 0) setExpanded(false);
      else setExpanded(expanded.has(key));
    }

    function openComposer({ focus = true } = {}) {
      for (const v of views) if (v !== view && v.open) v.close({ restoreFocus: false });
      const d = draft() ?? { text: "", request: null, sentText: null, pending: false, error: "" };
      drafts.set(traceId, d);
      area.value = d.text;
      form.hidden = false;
      open.setAttribute("aria-expanded", "true");
      root.classList.add("composing");
      renderCount();
      renderPending();
      setStatus(d.error, Boolean(d.error));
      if (count(traceId)) setExpanded(true);
      if (place === "panel") onComposeInPanel(traceId);
      if (focus) area.focus({ preventScroll: false });
    }

    function close({ restoreFocus = true } = {}) {
      if (form.hidden) return;
      const d = draft();
      if (d && !d.pending && !d.text.trim()) drafts.delete(traceId);
      form.hidden = true;
      open.setAttribute("aria-expanded", "false");
      root.classList.remove("composing");
      if (place === "panel") onComposeInPanel(null);
      if (restoreFocus) open.focus();
    }

    function dispose() {
      if (!form.hidden && place === "panel") onComposeInPanel(null);
      views.delete(view);
    }

    toggle.addEventListener("click", () => setExpanded(list.hidden));
    open.addEventListener("click", () => (form.hidden ? openComposer() : close()));
    cancel.addEventListener("click", () => {
      drafts.delete(traceId);
      area.value = "";
      setStatus("");
      close();
    });
    area.addEventListener("input", () => {
      const d = draft();
      if (d) d.text = area.value;
      renderCount();
      if (status.classList.contains("error") && area.value.trim()) setStatus("");
    });
    area.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        form.requestSubmit();
      } else if (e.key === "Escape" && !draft()?.pending) {
        e.stopPropagation();
        close();
      }
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = draft();
      if (!d || d.pending) return;
      const text = area.value.trim();
      if (!text) {
        setStatus("Write a few words first; a blank reply isn’t sent.", true);
        area.focus();
        return;
      }
      if (text.length > maxText) {
        setStatus(`That’s ${text.length} characters; a reply is at most ${maxText}.`, true);
        area.focus();
        return;
      }
      // a retry of the same words is the same reply: same request id, so the wall stores it once
      if (!d.request || d.sentText !== text) d.request = newRequest();
      d.sentText = text;
      d.pending = true;
      d.error = "";
      sent.add(d.request);
      setStatus("Sending…");
      renderAll();
      const result = await post(traceId, text, d.request);
      d.pending = false;
      if (result.reply) {
        add({ ...result.reply, mine: true });
        drafts.delete(traceId);
        for (const v of views) if (v.traceId === traceId) v.landed();
        announce("Your reply was left beneath the thought.");
        return;
      }
      d.error = result.error;
      renderAll();
      const mineNow = [...views].find((v) => v.traceId === traceId && v.open);
      mineNow?.showError(result.error);
    });

    view.landed = () => {
      area.value = "";
      setStatus("");
      renderPending();
      if (!form.hidden) {
        const hadFocus = root.contains(document.activeElement);
        close({ restoreFocus: hadFocus });
      }
      setExpanded(true);
      const flash = document.createElement("span");
      flash.className = "answers-left";
      flash.textContent = "left";
      bar.append(flash);
      setTimeout(() => flash.remove(), 2600);
    };
    view.showError = (message) => {
      setStatus(message, true);
      renderPending();
    };
    view.renderPending = renderPending;

    function renderAll() {
      for (const v of views) if (v.traceId === traceId) v.renderPending();
    }

    views.add(view);
    update();
    return view;
  }

  /** The stored reply, or an error to show; never throws. Checks the stream for a lost answer. */
  async function post(traceId, text, request) {
    try {
      const res = await fetch("/reply", {
        method: "POST",
        headers: { accept: "application/json" },
        body: new URLSearchParams({ trace: String(traceId), text, request }),
        signal: AbortSignal.timeout(POST_TIMEOUT),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { reply: body };
      if (res.status === 404) return { error: "That thought is no longer on the wall, so there’s nothing to reply to." };
      if (res.status === 400 && body.error) return { error: `The wall said: ${body.error}. Your words are still here.` };
      throw new Error(`the wall answered ${res.status}`);
    } catch (err) {
      console.warn(err);
      // the answer was lost, but the wall may have stored it: if it came back on the stream, it did
      const echoed = (byTrace.get(traceId) ?? []).find((r) => r.request === request);
      if (echoed) return { reply: echoed };
      return { error: "It didn’t reach the wall. Your words are still here; try again, and it won’t be stored twice." };
    }
  }

  // timestamps age while the page sits open
  setInterval(() => {
    for (const v of views) {
      for (const li of v.root.querySelectorAll("li.reply")) {
        const r = (byTrace.get(v.traceId) ?? []).find((x) => x.id === Number(li.dataset.id));
        if (r) li.querySelector(".when").textContent = relativeTime(r.createdAt);
      }
    }
  }, 60_000);

  return {
    add,
    count,
    mount,
    /** True while any composer holds words or a send is in flight. */
    get busy() {
      return [...drafts.values()].some((d) => d.pending || d.text.trim());
    },
  };
}
