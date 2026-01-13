import { onRequestOptions as __api_analyze_sentence_js_onRequestOptions } from "D:\\Willena Website\\willenaenglish.github.io\\functions\\api\\analyze-sentence.js"
import { onRequestPost as __api_analyze_sentence_js_onRequestPost } from "D:\\Willena Website\\willenaenglish.github.io\\functions\\api\\analyze-sentence.js"

export const routes = [
    {
      routePath: "/api/analyze-sentence",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_analyze_sentence_js_onRequestOptions],
    },
  {
      routePath: "/api/analyze-sentence",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_analyze_sentence_js_onRequestPost],
    },
  ]