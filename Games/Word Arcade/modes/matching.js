// New preferred entry point for Matching mode (formerly Meaning).
// Delegates to shared core; exported function run(context) for mode registry.
import { runMatchingCore } from './matching_core.js';

export function run(context){
  runMatchingCore(context, { sessionModeKey: 'matching', introTitle: 'Match English with Korean!' });
}
