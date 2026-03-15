import type { DeapiModelCatalog } from "@/types/deapi-pricing"

export const DEAPI_MODEL_CATALOG: DeapiModelCatalog = {
  generatedAt: "2026-03-15T06:54:46.142Z",
  categories: [
  "background-removal",
  "image-to-image",
  "image-to-text",
  "image-to-video",
  "image-upscale",
  "text-to-embedding",
  "text-to-image",
  "text-to-music",
  "text-to-speech",
  "text-to-video",
  "video-to-text"
],
  modelsByCategory: {
  "text-to-speech": [
    "Chatterbox",
    "Kokoro",
    "Qwen3_TTS_12Hz_1_7B_Base",
    "Qwen3_TTS_12Hz_1_7B_CustomVoice",
    "Qwen3_TTS_12Hz_1_7B_VoiceDesign"
  ],
  "image-to-image": [
    "Flux_2_Klein_4B_BF16",
    "QwenImageEdit_Plus_NF4"
  ],
  "text-to-video": [
    "Ltx2_19B_Dist_FP8",
    "Ltx2_3_22B_Dist_INT8",
    "Ltxv_13B_0_9_8_Distilled_FP8"
  ],
  "image-to-video": [
    "Ltx2_19B_Dist_FP8",
    "Ltx2_3_22B_Dist_INT8",
    "Ltxv_13B_0_9_8_Distilled_FP8"
  ],
  "video-to-text": [
    "WhisperLargeV3"
  ],
  "image-to-text": [
    "Nanonets_Ocr_S_F16"
  ],
  "text-to-music": [
    "AceStep_1_5_Turbo"
  ],
  "text-to-embedding": [
    "Bge_M3_FP16"
  ],
  "background-removal": [
    "Ben2"
  ],
  "text-to-image": [
    "Flux_2_Klein_4B_BF16",
    "Flux1schnell",
    "ZImageTurbo_INT8"
  ]
},
  parameterKeysByCategory: {
  "text-to-speech": [],
  "image-to-image": [
    "steps"
  ],
  "text-to-video": [
    "duration",
    "height",
    "width"
  ],
  "image-to-video": [
    "duration",
    "height",
    "width"
  ],
  "video-to-text": [
    "durationseconds"
  ],
  "image-to-text": [],
  "text-to-music": [],
  "text-to-embedding": [],
  "background-removal": [
    "height",
    "width"
  ],
  "text-to-image": [
    "height",
    "steps",
    "width"
  ]
},
}
