# 六如 — Transform the Guestbook into an Interactive Elemental Experience

The current 六如 website is functional but visually very plain. It currently presents a small centred form, a native category dropdown, a basic text input, and a simple chronological list of messages.

Keep the existing six-category guestbook concept and existing backend/data, but radically transform the frontend into a rich, playful, highly interactive experience.

This is no longer a request for minor UI polish.

Make substantial visual and interaction changes.

The final result should feel like entering an atmospheric interactive artwork rather than filling out an HTML form.

The six existing types remain:

- Dream
- Illusion
- Bubble
- Shadow
- Dew
- Lightning

Preserve the existing Chinese names/symbols wherever they already exist and use them as part of the visual identity.

Preserve:

- existing guestbook posting
- existing stored messages
- timestamps
- current backend/API/database behaviour
- the six existing types
- the 240-character limit
- existing useful accessibility behaviour
- `/readme/` and other required routes

Do not replace real stored messages with mock data.

Throughout this brief, **comments**, **messages**, and **human thoughts** mean the existing anonymous guestbook entries, not a new threaded-comment feature. **Model thoughts** are separately labelled, generated fragments and must never be presented or stored as human submissions.

This is a living product brief. Follow the improvement process in `CLAUDE.md`: you are encouraged to improve the prompts, harness, and even the project's creative goal when doing so demonstrably strengthens the result. Keep those documents consistent, explain material changes, and preserve stored human data, essential functionality, and applicable course constraints. Do not remove requirements merely to make the work easier or declare it finished.

---

# 1. Completely rethink the page composition

The current narrow column of form controls should disappear.

Create a much more expansive composition that uses the available screen.

The experience should have two major areas:

1. **The creation / elemental selection experience**
2. **The twin crystal-ball experience: human comments and model thoughts**

The second area should contain two distinct but visually connected orbs: the guestbook orb for real human comments, and a second orb for the model's continuously generated thoughts. Make their different sources immediately understandable without turning the page into a dashboard.

These should feel connected rather than like unrelated sections of a webpage.

The page should have a strong sense of depth, colour, motion and atmosphere.

Do not make this look like:

- a SaaS dashboard
- a conventional social network
- a Bootstrap form
- six ordinary rectangular buttons
- six generic gradient cards
- a collection of unrelated particle effects

Everything should belong to one visual world.

---

# 2. Large thought composer at the top

The act of writing should be prominent.

Replace the current small ordinary text field with a large, beautifully styled writing area near the top of the experience.

Use wording along the lines of:

**What passed through your mind?**

Supporting text can remain poetic and understated, for example:

**A thought, a feeling, a fragment — not an essay.**

The text area should:

- be visually substantial
- comfortably support multiple lines
- feel like part of the artwork
- retain the 240-character limit
- show a live character count
- have excellent focus and typing states
- work properly on mobile
- never resemble an unstyled native HTML input

Typing itself can have subtle visual feedback if it improves the experience.

Do not make text difficult to read.

---

# 3. Replace the category dropdown with six large interactive elemental cards

The existing `<select>` must no longer be the primary category interface.

Present all six types simultaneously as six visually distinct interactive cards.

On desktop, aim for an attractive grid such as 3 × 2.

Adapt the layout naturally for smaller screens.

Each card should contain:

- the existing symbol/Chinese character where appropriate
- English name
- a very short description
- a distinctive visual identity
- its own interactive animation
- a clearly visible selected state

The cards are one of the centrepieces of the site.

They should be fun to explore even before the visitor writes anything.

## Dream

Mood:

- soft
- surreal
- floating
- sleepy
- celestial

Possible behaviour:

- slowly drifting particles
- clouds or mist
- floating stars/light motes
- gentle perspective movement
- elements that follow the pointer slightly

Hovering should make the card seem as though the surface is drifting out of reality.

Suggested meaning:

> something that felt real, then faded

## Illusion

Mood:

- refracted
- deceptive
- unstable
- optical

Possible behaviour:

- chromatic separation
- duplicate layers
- refraction
- warped text
- shifting perspective
- false copies briefly appearing around the pointer

It should feel like the card cannot quite be visually trusted.

Suggested meaning:

> something that wasn't what it seemed

## Bubble

Mood:

- playful
- iridescent
- weightless
- fragile

Possible behaviour:

- bubbles rising
- bubbles responding to the cursor
- bubbles distorting slightly
- bubbles popping
- iridescent highlights

Use the existing asset:

`assets/bubble_background_music.mp3`

This is the canonical background music for the Bubble experience.

Suggested meaning:

> something fragile and brief

## Shadow

Mood:

- dark
- smoky
- mysterious
- lingering

Possible behaviour:

- elongated shadows
- an offset silhouette that follows the cursor
- ink/smoke-like movement
- darkness flowing around the card
- subtle depth changes

Suggested meaning:

> something that followed or lingered

## Dew

Mood:

- fresh
- reflective
- quiet
- delicate

Possible behaviour:

- water droplets forming
- droplets sliding across the surface
- refraction
- subtle ripples
- tiny highlights responding to movement

Suggested meaning:

> something small and temporary

## Lightning

Mood:

- sudden
- energetic
- electric
- intense

Possible behaviour:

- branching electrical arcs
- rapid but tasteful flashes
- small sparks responding to the pointer
- charged borders
- sudden energetic movement

Suggested meaning:

> something sudden and intense

Do not make lightning effects dangerous or unpleasant.

Avoid large repetitive flashes and respect reduced-motion preferences.

---

# 4. Every type should have its own audio personality

Sound is part of the experience.

Selecting, hovering and submitting should have tasteful audio feedback.

Do not simply play the same click sound for every type.

Each elemental type should have an identifiable sound palette.

Suggested direction:

### Dream
- ethereal pad
- distant bell
- soft chime
- airy movement

### Illusion
- reversed tones
- shimmering glass
- strange stereo movement
- subtle pitch changes

### Bubble
Use:

`assets/bubble_background_music.mp3`

Complement it with:

- delicate bubble pops
- watery movement
- soft plinks

### Shadow
- low ambient tone
- soft dark whoosh
- distant resonant textures

### Dew
- small water droplets
- delicate glass-like tones
- gentle ripples

### Lightning
- electrical crackle
- short energetic zap
- restrained thunder impact

For the non-Bubble elements, find suitable high-quality sound/music assets where practical.

Only use assets that can legally be included in the project.

Prefer permissively licensed or public-domain/CC0 audio.

Bundle required assets locally rather than depending on fragile remote URLs at runtime.

Record attribution/licensing where necessary.

If suitable external sound effects cannot be obtained, create appropriate small sound effects using the Web Audio API rather than abandoning the audio experience.

Do not autoplay audio before the browser permits it.

Use the visitor's interaction with the page to initialise audio.

Provide an obvious but visually integrated mute/unmute control.

Remember the user's mute choice during the session if practical.

Sound should enrich the experience rather than become irritating.

---

# 5. Submission should feel like releasing the thought

The current ordinary form submission should become a memorable interaction.

Once the visitor has:

1. written their message;
2. selected an element; and
3. chosen **let it go**

play a short elemental release sequence.

The exact animation should depend on the selected type.

Examples:

- Dream: the text dissolves into drifting glowing particles.
- Illusion: the message splits into refracted copies and collapses into one point.
- Bubble: the message becomes enclosed in a bubble which floats away.
- Shadow: the thought becomes a shadow/smoke form and is drawn downward.
- Dew: the words condense into droplets which fall away.
- Lightning: energy traces through the letters and the thought is discharged.

These should be polished transitions, not long cutscenes.

The real POST/persistence operation must still happen correctly.

Do not fake submission just to allow an animation.

Provide appropriate failure behaviour if posting fails.

Every successfully posted comment should produce an elemental particle release and an arrival reaction in the human-comment orb. Existing stored comments should also have their own particle presence and interaction feedback; the effect must not be limited to comments created during the current page visit.

---

# 6. Transition from submission into the crystal-ball guestbook

Successful submission should naturally carry the user into the second major experience.

Instead of the thought simply appearing in a plain list, transition the released elemental energy toward a large crystal ball / scrying orb.

The movement should make it feel as though the visitor's message has joined the collection of thoughts left by everyone else.

This can involve:

- smooth camera/scroll movement
- the released particle or object travelling toward the orb
- the page environment changing
- colours transitioning
- the orb reacting to the new arrival
- the newly submitted message briefly becoming identifiable within the guestbook

The transition should feel continuous.

Avoid an abrupt page reload visually when JavaScript is functioning, while preserving functional fallback behaviour where required.

---

# 7. Build a major crystal-ball guestbook experience

The lower portion of the site should contain a large interactive crystal ball.

This first orb represents real human comments. The second orb described below represents model-generated thoughts; do not merge the two sources into an indistinguishable stream.

This should become the visual representation of the guestbook.

It should not just be a decorative image positioned next to the existing list.

Make it a real interactive part of the application.

The orb should feel:

- mysterious
- deep
- luminous
- reactive
- alive with other people's thoughts

Possible visual techniques include:

- animated internal fog
- refraction
- layered gradients
- moving highlights
- particle depth
- subtle reflections
- pointer-responsive lighting
- distorted message fragments
- rotating or drifting constellations of thoughts
- a pedestal or surrounding environment

Use CSS, Canvas, SVG, WebGL or another appropriate technology if it materially improves the result.

Choose an approach appropriate to the project's existing stack.

Do not add an enormous framework solely to make one effect.

---

# 8. Make other people's messages discoverable inside/around the orb

Do not display the guestbook primarily as the current plain vertical text list.

Represent existing messages visually around or within the crystal ball.

They might appear as:

- motes
- glyphs
- fragments
- orbiting traces
- points of light
- elemental objects
- translucent text fragments

The user should be able to explore them.

Hovering or selecting a trace should reveal the complete message in a readable manner along with:

- its elemental type
- its symbol
- relative timestamp

The complete message must remain easy to read once selected.

Do not sacrifice usability for the visual metaphor.

If the number of stored messages is large, design a sensible system for displaying them without turning the scene into clutter.

## Living display of human comments

The orb should continuously reveal real comments with fantasy visuals, even before anyone interacts with it.

Implement either of these modes, or a coherent combination:

- Rotate the featured comment approximately once every second using a soft magical transition.
- Show several comments at the same time, floating at different apparent depths inside the crystal ball.

Use real stored messages in both cases, not decorative invented quotes. Cycle through the available collection fairly rather than introducing engagement-based ranking. Bound the number of simultaneously rendered comments and particles without deleting stored guestbook entries.

A one-second visual cycle is an ambient presentation, not a one-second reading deadline. Hovering, focusing, selecting, or tapping a comment should hold a readable full-text view until the visitor dismisses it or chooses another comment. Provide an accessible way to pause automatic cycling and browse manually. Do not continuously announce every automatic change to screen readers.

Use a meaningful empty state when no human comments exist. A newly persisted comment should become discoverable promptly without resetting the whole scene.

---

# 9. Existing messages should inherit their element

A stored thought should visually behave according to its saved type.

For example:

- Dream thoughts may drift slowly.
- Illusion thoughts may shimmer or refract.
- Bubble thoughts may exist inside floating bubbles.
- Shadow thoughts may trail smoke or cast moving shadows.
- Dew thoughts may appear as droplets or refracted motes.
- Lightning thoughts may crackle briefly when approached.

Hovering a message should trigger a short elemental animation.

It should also trigger a subtle associated sound effect when audio is enabled.

Avoid constant noisy audio.

Do not have every message continuously play sound.

Interaction should cause the sound.

---

# 10. Make the orb physically interactive

Give visitors something enjoyable to do even if they do not post a message.

Explore interactions such as:

- dragging the orb to rotate/reveal thoughts
- moving the pointer to distort its internal contents
- hovering over elemental traces
- gently nudging floating messages
- causing ripples through the interior
- revealing obscured messages through movement
- letting different element types react differently to the pointer

Do not overcomplicate the controls.

The interaction should be discoverable through experimentation.

On touch devices, provide equivalent tap/drag interaction.

## Particle feedback for all mouse actions and comments

Make particle effects a consistent interaction language across the entire page, not an effect reserved for the submit button.

Cover mouse/pointer movement, hover and enter/leave, button press/release and clicks, dragging, scrolling/wheel input, and context-menu activation within the page. Use subtle trails, ripples, sparks, motes, or brief bursts appropriate to the active element and the surface being interacted with. Do not suppress normal scrolling, text selection, native context menus, form controls, or link behaviour merely to show an effect.

Give the composer, elemental cards, controls, both crystal balls, and visible comments appropriate feedback. Comments should react when they appear, are selected, or are explored, as well as when a new human comment is successfully left. Model thoughts may have related but recognisably different particles.

Use one coherent, bounded particle system or a small number of coordinated layers. Throttle high-frequency events, avoid duplicate bursts from overlapping event handlers, expire particles, and clean up listeners and animation loops. Particle density must remain bounded during prolonged interaction.

Decorative layers must not capture pointer events or obscure readable text. Provide equivalent feedback for keyboard and touch interactions where meaningful, and simplify or disable moving particles under reduced-motion preferences. Universal feedback does not mean a constant particle storm.

---

# 11. Ambient world

The empty space surrounding the interface should contribute to the experience.

The existing nearly-black background can remain part of the identity, but it should no longer feel empty.

Use restrained atmospheric effects such as:

- moving haze
- faint stars
- ink-like gradients
- elemental particles
- subtle depth layers
- responsive light
- very slow environmental motion

The environment may subtly inherit the currently selected element.

For example, selecting Bubble might introduce drifting translucent spheres, while Lightning could add faint electrical activity.

Do not make the entire page a constant particle storm.

Maintain hierarchy.

---

# 12. Motion quality

Motion is a major part of this redesign.

Use animation deliberately.

The site should include:

- responsive hover animation
- pointer-reactive effects
- particle feedback across mouse actions and comment interactions
- selected-state transitions
- submission/release animations
- crystal-ball movement
- cycling or simultaneously floating human comments
- arrival and exploration of model-generated thoughts
- message interaction
- ambient animation

Different elemental types should have genuinely different motion characteristics.

Do not simply recolour one animation six times.

Optimise continuous effects so the site remains smooth.

Prefer GPU-friendly transforms/opacity where appropriate.

Pause or simplify expensive animation when off-screen if useful.

Respect:

`prefers-reduced-motion`

Reduced-motion mode should retain the visual identity while eliminating aggressive movement.

---

# 13. Colour

The existing monochrome presentation is too restrained for this version.

Introduce a richer elemental palette.

Each element should have a recognisable visual colour identity, while still belonging to the same overall design language.

Possible directions:

- Dream — lavender / indigo / pale gold
- Illusion — magenta / cyan / spectral colour splitting
- Bubble — aqua / pink / iridescent highlights
- Shadow — black / violet / muted crimson
- Dew — cool blue / green / silver
- Lightning — electric yellow / blue / white

These are directions, not rigid colour codes.

Create a sophisticated palette rather than six flat primary colours.

Dark backgrounds can help the elemental effects glow.

Maintain readable text contrast.

---

# 14. Typography and Chinese identity

Keep 六如 visually important.

The Chinese identity should feel intentionally integrated rather than being a tiny prefix in a heading.

Explore:

- oversized 六如 typography
- subtle calligraphic influence
- vertical characters
- elemental Chinese glyphs
- decorative brush/ink details
- blending traditional visual references with modern interactive effects

Do not turn the site into a stereotypical "Asian" themed interface.

Use the existing concept respectfully and thoughtfully.

---

# 15. The site should still feel like 六如

Although this is now visually dramatic, do not lose the central idea:

These thoughts are temporary.

They pass.

The experience can be colourful, playful and explosive while still conveying ephemerality.

Use disappearance, diffusion, drifting, refraction, fading and transformation as recurring design ideas.

The elemental spectacle should support the concept rather than obscure it.

---

# 16. Do not turn it into social media

Do not add:

- profiles
- usernames
- avatars
- follower systems
- rankings
- trending content
- algorithmic sorting
- comments on other comments
- reply threads
- engagement streaks
- notifications
- conventional social-feed cards

The crystal ball is a collection of passing anonymous thoughts, not a social network.

The existing guestbook comments and the separate model-thought stream are part of this brief, not exceptions that permit social-network features. Model thoughts are associative fragments inspired by the shared collection, not replies impersonating visitors.

---

# 17. Progressive enhancement and fallback

The richer interactive experience can rely on JavaScript, but the underlying guestbook must remain robust.

Where practical:

- preserve the existing server-rendered initial data
- preserve successful ordinary POST behaviour
- do not make stored messages inaccessible if an animation library fails
- do not lose data because a visual transition failed
- ensure form validation still works
- avoid breaking the backend merely to create a prettier frontend

The backend is the source of truth.

The human guestbook must remain fully usable when the model is loading, paused, unavailable, or failing. Extend the backend only as needed for inference and separate model-memory storage without changing the existing human-posting contract or overwriting human data.

---

# 18. Responsive design

This experience must work on:

- large desktop
- normal laptop
- tablet
- mobile

Do not just shrink the desktop layout.

On smaller screens:

- cards can reorganise
- effects can simplify
- the crystal balls can resize or stack vertically
- interactions should become touch-friendly
- performance-heavy details may be reduced

The large text composer should remain pleasant to use on a phone.

---

# 19. Accessibility and audio controls

The interface can be unusual without becoming inaccessible.

Ensure:

- keyboard interaction works
- selected cards expose their selected state appropriately
- focus states are visible
- the composer has a proper label
- both crystal balls have accessible textual representations with clear human/model attribution
- automatic comment cycling can be paused and selected text remains readable
- model generation has an accessible pause/resume control and understandable status
- automatic visual updates do not create constant screen-reader announcements
- audio can be muted
- no information exists only as sound
- motion reduction is respected
- dangerous/repetitive flashing is avoided
- colour is not the sole indicator of category

The visual experience can be experimental while the underlying semantics remain sound.

---

# 20. Polish matters

Do not stop once the basic structure exists.

Spend significant time refining:

- animation timing
- easing
- hover behaviour
- sound volume
- layering
- depth
- spacing
- typography
- card transitions
- orb interaction
- message reveal
- submission flow
- model-thought quality and continuity
- memory compaction and long-running stability
- mobile layout
- performance

Test the complete experience repeatedly.

The goal is for users in the classroom session to want to keep moving their cursor around simply to see what the page does.

---

# 21. Add a second crystal ball for continuous model brainstorming

Use the instruction-tuned **LiquidAI/LFM2.5-230M** model as an initial candidate, not a mandatory choice:

https://huggingface.co/LiquidAI/LFM2.5-230M

The model should repeatedly brainstorm from existing human comments and its own retained thoughts. This is a continuing associative process, not a one-shot response generated only after a visitor submits something.

## Real inference and runtime integration

The coding agent should choose the model, parameter size, quantization level, and compatible runtime that best suit this application and its actual deployment environment. You are explicitly authorised to choose a different model without asking the user when it provides a better fit. Use a verified checkpoint or supported conversion/quantization, and document the choice rather than silently substituting models. Never replace real inference with hard-coded phrases or random combinations of stored messages.

Read the model card, verify the runtime's actual support, use the correct chat template, and document the model revision, loading method, required dependencies, and licence considerations. Do not assume a model download URL is a hosted inference API or that native weights run directly in the existing JavaScript stack.

Choose the simplest verified integration compatible with this repository. A local/self-hosted inference companion is acceptable if needed; browser inference is acceptable only after confirming model/runtime compatibility and testing it. Keep expensive inference off the UI thread and out of blocking guestbook request handling. Do not commit model weights to the repository or expose credentials to the browser.

Treat this as an experimental lightweight associative generator. The [model card](https://huggingface.co/LiquidAI/LFM2.5-230M) cautions against creative-writing and reasoning-heavy workloads, so evaluate actual relevance, diversity, and repetition rather than assuming the small model can produce sophisticated long-form reasoning. Evaluate other suitable models when they offer a better balance of output quality, memory use, latency, and runtime compatibility; the initial candidate is not a hard requirement.

## Memory-aware model and quantization selection

**If an unquantized model does not fit comfortably within available memory, use a compatible quantized model. The agent decides which model and quantization level work best; neither LFM2.5-230M nor a particular bit width is mandatory.** Do not insist on full precision or abandon inference merely because the first candidate is too large.

Inspect the actual inference target before choosing. Check usable RAM, VRAM or unified memory, container/process limits, and browser/runtime restrictions where relevant. Do not assume that the development machine's resources are available in production. Where limits cannot be measured, record a conservative explicit budget and mark target verification as outstanding.

Budget for peak loading and generation, not just the model file: include weights, runtime overhead, activations, attention or recurrent-state caches as applicable, temporary buffers, the configured context/output lengths, and the rest of the application. Leave headroom for the guestbook and visual effects. Do not deliberately load a model that is already known not to fit.

Compare a small, relevant set of compatible model sizes and quantizations. Consider 8-, 6-, 5-, or 4-bit variants, or other supported formats, only where the selected runtime and model actually support them. These are examples, not a required ladder. A smaller model at higher precision and a larger, more heavily quantized model are both legitimate candidates; decide from evidence, not parameter count or bit width alone. Verify the quantized artifact's provenance, checkpoint revision, licence, tokenizer/chat template, and runtime support.

Choose the best practical balance of stable memory use, relevance to human comments, variety, repetition resistance, generation latency, and deployment simplicity. Run representative inference and repeated generation/compaction on the selected configuration. Record peak memory and latency where measurable, alongside a brief output-quality assessment. Do not assume that lower precision is always faster or that successful model loading proves sustained inference will fit.

For insufficient memory or an out-of-memory failure, use a bounded fallback strategy chosen by the agent: a more memory-efficient supported quantization, a smaller model, a shorter context/output budget, or a suitable alternative execution backend. Release the failed model and its resources before loading another; do not keep multiple candidate models resident unnecessarily or repeatedly retry a configuration known not to fit. Preserve valid thought memory, reapply the selected model's token budget and chat template, and keep the single-flight generation rule intact.

Make the chosen model, revision, quantized artifact/format, runtime/device, and context/output limits configurable. Record the effective configuration and selection rationale in the project documentation; update model labels and tests when the choice changes. A model switch must not reset valid human data or disguise the model actually running.

Test constrained-memory handling and recovery. If no verified configuration fits, retain the last valid thoughts, show an honest unavailable state, and keep the human guestbook usable. Distinguish measured behaviour from estimates, simulated failure tests, and checks that could not be run. Autonomous selection does not authorise new paid services or credentials beyond existing permissions.

## Continuous generation loop

Once the model is ready and there are human comments to draw from, automatically begin generating short thoughts every few seconds while the feature is running. Use a configurable interval, with approximately 3–5 seconds between completed generations as a starting point; actual inference latency must not create overlapping jobs or an ever-growing queue.

Each iteration should:

1. Read a bounded selection of real human comments, including newly arrived comments when available.
2. Include the rolling memory and a bounded set of recent model thoughts.
3. Ask for one short, fresh association, question, contrast, or imaginative fragment inspired by that context and the 六如 theme.
4. Validate the output, avoid empty or excessively repetitive fragments, and clearly label accepted output as model-generated.
5. Add the new thought to the second orb and update/compact memory before the next iteration.

Continue even when no new human comment arrives, drawing on the existing human comments and accumulated model memory. Periodically re-anchor on actual human comments so the process does not become an entirely self-referential loop. Use varied sampling and prompts where useful, but do not confuse randomness with novelty or relevance.

Keep one generation in flight per intended stream. Make scheduler ownership explicit: multiple viewers, reconnects, or repeated initialisation must not accidentally multiply a shared generator. Clean up timers and jobs, use bounded retries/backoff, and avoid stale results overwriting newer state. Document whether the stream is shared or per session and make the UI consistent with that choice.

When no human comments exist, show a waiting state rather than inventing human input. Expose loading, thinking, paused, and unavailable/error states. Provide pause/resume without removing the ability to run continuously. On failure, retain the last valid thoughts and memory, keep the guestbook working, and never disguise canned fallback text as successful inference.

## The model-thought orb

Give the second crystal ball its own recognisable fantasy identity while keeping it in the same visual world as the human orb.

Generated thoughts should emerge as luminous fragments, drifting glyphs, constellations, mist, or other coherent elemental forms. Display a rotating selection or several floating thoughts at once, with readable full-text inspection and accessible alternatives.

Clearly distinguish **human comments** from **model thoughts** through labels and semantics, not colour alone. It should be possible to understand that one orb contains what people actually left and the other contains the model's ongoing associations.

The orbs may exchange subtle strands of light or particles to suggest inspiration, but do not imply a generated statement was written by a particular visitor or is a faithful summary unless that relationship is actually supported.

Human comments and generated text are untrusted content. Render them safely as text, not executable HTML. They are inspiration for generation, not instructions that can change application permissions, run tools, or rewrite the development harness. The runtime model's brainstorming loop is separate from the coding agent's improvement loop in `CLAUDE.md`.

---

# 22. Keep model-thought memory bounded and continuous

Keep track of generated thoughts so each generation can build on previous ones without allowing context, storage, or rendered content to grow indefinitely.

Use a bounded working-memory design such as:

- a fixed-capacity ring buffer of recent model thoughts;
- a compact rolling summary of older themes, useful associations, and open directions;
- a bounded sample of human comments kept separately from model-generated material;
- small metadata such as generation count, update time, and the last processed human-comment identifier.

Choose and document explicit limits for recent thought count, per-thought length, human-context size, summary size, and total input/output tokens. Keep within the selected runtime/model context limit with room for generation. A count limit alone is insufficient if each item can have unlimited text.

Compact older model thoughts into the rolling summary before the next iteration would exceed the budget. Feed that summary and recent thoughts into subsequent generations so the process continues from what it has generated rather than restarting from scratch. Preserve the distinction between human source material and model speculation during compaction.

Do not merely append every output to a forever-growing prompt, database table, log, or DOM tree. Do not retain an unbounded full-text archive under the guise of bounded working memory. Older generated wording may be discarded after compaction; the human guestbook's existing stored entries must never be deleted or rewritten to enforce model-memory limits.

Enforce hard bounds even when summarisation fails or produces too much text. Preserve the last valid summary and use a deterministic trimming/eviction fallback so the next iteration remains valid. Deduplicate repetitive material and reserve space for fresh human input.

Retain the bounded state across refreshes or restarts where appropriate to the chosen stream ownership, using separate model-state storage. Persist updates consistently so interruptions or concurrent requests cannot corrupt the memory or mix model text into human records.

Verify the loop across enough simulated iterations to trigger repeated compaction. Check that memory/context/rendered-item sizes stay within their configured limits, that new human comments still influence later generations, and that failure recovery does not reset valid memory unnecessarily. Supplement deterministic scheduler/compaction tests with an actual inference smoke test; mocked output alone does not establish that model integration works.

---

# 23. Desired user journey

The ideal flow is:

### Arrival
The user lands in a mysterious but inviting animated environment.

### Write
A large text area immediately invites them to leave a thought.

### Choose
They explore the six elemental cards.

Each responds dramatically and differently.

### Release
They select one and press **let it go**.

Their thought performs an elemental release animation accompanied by matching sound.

### Transition
The released thought travels into / toward the crystal ball.

### Discover
The interface naturally focuses on the guestbook orb.

Their thought joins the existing anonymous messages, which cycle through the orb or float together inside it.

### Explore
They move around the crystal ball, discovering thoughts other people have left.

Different types animate and sound different when interacted with. Mouse actions and comments leave coherent elemental particle traces.

### Watch the second orb think
A neighbouring crystal ball produces clearly labelled model thoughts every few seconds, inspired by the human collection and its own bounded evolving memory.

Visitors can inspect or pause the stream without interrupting human posting or confusing generated fragments with real comments.

### Return
They can smoothly return to the composer and leave another thought.

This should feel like one continuous experience, not a collection of unrelated UI sections.

---

# 24. Final creative target

Be ambitious.

The starter application is deliberately basic. Do not allow its current visual implementation to constrain the final result.

Preserve its concept and working data model, but make the frontend feel transformed.

The final experience should have:

- a striking first impression
- six highly interactive elemental cards
- a prominent writing experience
- distinctive animation systems
- meaningful colour
- meaningful audio
- a memorable elemental submission sequence
- coherent particle feedback for mouse actions and comments
- a compelling human-comment crystal ball with cycling or floating messages
- a distinct second crystal ball powered by real inference using the agent-selected model and appropriate quantization
- continuous brainstorming grounded in human comments and bounded model memory
- playful discovery of other people's messages
- strong responsiveness
- excellent polish

It should be immediately obvious that this is no longer the starter guestbook.

Someone seeing the before-and-after versions side by side should regard them as a dramatic transformation.

At the same time, someone using the finished site should still understand the central idea:

**write something fleeting, give it a form, and let it pass into a shared collection of other people's fleeting thoughts — with a neighbouring orb continually imagining what those fragments might become.**
