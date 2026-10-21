# Sound, type and licences

Every sound except the Bubble music is synthesised in the browser with the
Web Audio API (`public/js/audio.js`): six small palettes, one per as-if, and
a seventh voice for the model's glass, so there is no third-party audio to
license. Sound starts only after you touch
the page, and the control in the corner mutes it for the session. The Bubble
music, `assets/bubble_background_music.mp3`, was supplied with this riff's
brief by the pod that wrote it. The hanzi are set in
[Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng) and the text
in [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond),
both under the SIL Open Font License; the subsets and their licence texts
are in `public/fonts/`. The model is under the
[LFM Open License v1.0](https://huggingface.co/LiquidAI/LFM2.5-230M-ONNX/blob/main/LICENSE);
its weights are fetched from Hugging Face by your browser, not redistributed
here, and the runtime is [transformers.js](https://github.com/huggingface/transformers.js)
(Apache 2.0) with onnxruntime-web (MIT).
