// Legacy wrapper now delegating to shared matching core (audio removed).
import { runMatchingCore } from './matching_core.js';

export function runMeaningMode(ctx){
  // Preserve external startGame signature; strip audio fields if present.
  const { playTTS, preprocessTTS, ...rest } = ctx || {};
  runMatchingCore(rest, { sessionModeKey: 'matching', introTitle: 'Match English with Korean!' });
}
