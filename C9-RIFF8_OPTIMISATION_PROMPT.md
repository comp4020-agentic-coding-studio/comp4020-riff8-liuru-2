# COMP4020 Riff 8 — Website Optimisation Prompt

Review the current website and repository before making changes: https://comp4020-riff8-liuru-2.fly.dev/

Refine the existing experience and add lightweight anonymous replies to other people's thoughts. Preserve the concept, structure, poetic atmosphere, and minimal visual identity. **Do not rewrite the whole project**, replace its framework, or redesign it as a generic SaaS product. Reuse existing components, styles, and data patterns; make focused, incremental changes.

## 1. Preserve and polish the experience

- Keep the main flow immediately understandable: **write a thought → choose a form → let it go**.
- Preserve all six forms and their symbolic meaning: **夢 / Dream, 幻 / Illusion, 泡 / Bubble, 影 / Shadow, 露 / Dew, 電 / Lightning**.
- Improve typography, spacing, alignment, readability, and visual hierarchy while reducing clutter.
- Make form choices clearly interactive with subtle but distinct hover, selected, keyboard-focus, and touch states. Make short explanations discoverable without relying on hover alone.
- Make the thought input the clear starting point. Keep the **240-character limit**, show a character count, and provide helpful inline feedback for empty text or a missing form.
- Provide restrained submission feedback that makes “letting go” feel intentional. Avoid unnecessary pop-ups and complex forms.
- Preserve the two-glass presentation of human thoughts and locally generated AI thoughts. Clarify their labels and visual distinction without losing the shared aesthetic or changing existing generation behaviour.

## 2. Add lightweight anonymous replies

- Add a discreet **Reply** button to each human-authored thought. Keep the parent thought visible and make the target of a reply unambiguous.
- Open a compact inline composer with a labelled text field, character count, **Send reply**, and **Cancel**. Clearly show whether it is expanded; avoid modal dialogs and a full social-media interface.
- Support idle, expanded, submitting, success, and error states. Prevent duplicate sends while submitting, preserve the draft on failure, and offer retry with clear inline feedback.
- Keep replies anonymous, without requiring accounts, names, email addresses, or public user identifiers. Label authors neutrally, for example **Anonymous**. Do not imply stronger privacy guarantees than the implementation provides.
- Use a **240-character reply limit**. Validate trimmed text as non-empty and within the limit on both client and server; render user content safely as text.
- Display replies directly beneath their parent in a quiet, readable, single-level thread. Show a reply count and allow replies to be expanded or collapsed. Use a consistent chronological order and a gentle empty state.
- Keep the interaction small: no nested replies, likes, profiles, notifications, or automatic AI responses. Reply controls apply to human thoughts; preserve the distinction from AI-generated content.
- Store replies through the existing persistence layer with a stable parent-thought reference. Replies must survive refresh and be available to other visitors. Handle missing or deleted parent thoughts gracefully and follow existing content-retention rules. If shared storage is absent, identify the minimum required backend change rather than presenting browser-only storage as shared replies.

## 3. Accessibility and mobile behaviour

- Use semantic buttons and labels, visible focus indicators, sufficient contrast, and comfortable touch targets. Do not communicate selection or errors through colour alone.
- Make selection, submission, reply expansion, sending, and cancellation fully keyboard accessible. Expose expanded states and announce errors and submission status to assistive technology.
- Manage focus predictably when opening or closing the reply composer. Respect reduced-motion preferences.
- Ensure inputs, form choices, both glasses, and reply threads remain readable on narrow screens without horizontal scrolling. Keep controls usable when the mobile keyboard is open.

## 4. Implementation and verification

- Follow repository instructions and existing conventions. Preserve unrelated functionality and avoid unnecessary dependencies or broad refactoring.
- Verify the original thought flow, all six forms, human/AI distinction, reply open/cancel/send/retry states, blank and over-limit input, duplicate-submit prevention, persistence after refresh, keyboard access, and mobile layouts.
- Run relevant existing checks and add targeted tests for new reply validation and persistence where supported.
- Deliver the implemented changes with a concise summary of what changed, how it was verified, and any required setup or remaining limitations. Do not claim checks passed unless they were run.
