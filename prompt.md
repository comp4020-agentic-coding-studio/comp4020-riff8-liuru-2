Work on this repository:
https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-2

Current deployed website:
https://comp4020-riff8-liuru-2.fly.dev/

Implement a focused improvement to 六如: make it easier to discover, read, and respond to other people's thoughts, with reliable persistence and live updates.

Preserve the six forms, poetic atmosphere, anonymous participation, and distinction between human thoughts and locally generated AI content. Keep the existing architecture and visual identity.

Start by reading the repository instructions, README, and C9-RIFF8_OPTIMISATION_PROMPT.md. Inspect the current implementation and run the application. Verify the observations below against the current checkout; extend existing functionality instead of rebuilding it.

1. Make reading an obvious and comfortable part of the experience

- Add a quiet, visible “Explore the thoughts” entry near the composer so visitors can browse before writing.
- Improve spacing and hierarchy so the composer, six form choices, submission button, and browsing section feel connected. Preserve the character of the illustrated cards.
- Strengthen the existing reading panel beneath the human orb: readable body text, sufficient contrast, clear kind and timestamp, and a stable layout for long thoughts.
- Preserve the existing previous/next and hold controls. Make the current held/running state visually understandable. A manually selected thought should remain readable when new content arrives.
- Apply the selected kind consistently to the orb and plain-text list. Show the matching count, a clear way to return to all thoughts, and an informative empty state.
- Make a thought in the text list selectable so it opens the same reading panel and identifies the corresponding light. Keep focus and scrolling predictable.
- Make explanations and selected states work through touch and keyboard as well as hover.

2. Add lightweight anonymous replies

The existing optimisation document proposes replies, but the inspected application does not yet implement them.

- Add a discreet “Reply” action to human thoughts in both the reading panel and text list, using a shared interaction pattern.
- Keep the parent thought visible while composing. Provide a labelled text field, a 240-character count, Send reply, and Cancel.
- Show replies in a collapsible, single-level thread beneath their parent, with a reply count and consistent chronological ordering.
- Keep replies anonymous. Do not add accounts, profiles, likes, nested conversations, or notifications.
- Persist replies in SQLite with a stable parent reference. Use a migration compatible with existing data.
- Validate input on the server and client, reject blank or over-limit submissions with useful feedback, and safely render content as text.
- Preserve drafts after failure, prevent repeated sends while pending, and provide retry.
- Broadcast saved replies to other connected visitors. Deduplicate events and update counts without interrupting reading or typing.
- Keep replies separate from AI output. Do not automatically add replies to the model's input.

3. Make posting and live updates reliable

Inspect public/js/main.js, src/server.ts, and src/db.ts. The inspected version opens an EventSource without reconnect reconciliation, and echoes a release token without using it for server-side idempotency.

- Recover thoughts and replies missed during a disconnected period or initial connection race. Use a documented cursor/replay or reconciliation approach with stable IDs and deduplication.
- Do not assume the existing latest-200 query guarantees complete recovery. Define and handle any recovery limit honestly.
- Add restrained connection feedback when updates are interrupted and when recovery completes.
- Make submission retries idempotent. Reuse the same request ID when retrying the same submission, and enforce deduplication in persistent storage.
- An intentionally new submission must still be allowed even when its text matches an earlier one.
- Ensure the orb, text list, counts, and threads remain consistent after local submissions, remote events, reconnects, and refreshes.
- Preserve the existing failure recovery and release animation. Show success only when storage is confirmed.

4. Make the AI orb's resource use understandable and controllable

- Require an explicit first activation before downloading model weights; scrolling into view alone should not start a first-time download.
- Retain the existing download-size disclosure, progress reporting, worker execution, and human/generated labels.
- Provide a usable cancel/stop action during loading and a retry action after failure.
- Keep loading, running, paused, stopped, and failed states consistent across visible text and accessible announcements.
- Preserve existing single-generator coordination across tabs.
- The human wall must remain usable when the model is asleep, unavailable, cancelled, or loading.

Verification and delivery

Run the relevant existing checks, including pnpm check. Add focused regression tests for reply persistence/validation, idempotent retries, and reconnect recovery.

Verify locally with two independent browser sessions: posting and replying update the other session; disconnected sessions catch up; retries do not duplicate stored content; incoming events preserve an open draft and selected thought.

Check narrow mobile layouts, keyboard operation, reduced motion, long text, empty filters, and model-loading failure/cancellation. Use local test data for mutation tests.

Implement and verify the changes rather than stopping at a proposal. Keep changes scoped and avoid unnecessary dependencies. Deliver a concise summary, screenshots of the main improvements, tests actually run, and any remaining limitations. Prepare the work for review without deploying to production.