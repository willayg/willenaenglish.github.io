// Public import for the canonical Willena student question renderer.
//
// IMPORTANT: this file does NOT contain a second renderer and does NOT change rendering behavior.
// It simply re-exports the exact renderer used by Test Prep V2 so other student apps
// (for example Grammar Foundations) can import a stable, easy-to-find shared path.
//
// Why this exists:
// - keeps future apps from copying or forking the Test Prep renderer
// - gives agents/developers one obvious shared import path to use
// - lets us move the real renderer implementation later without changing every app import
//
// Current implementation owner:
//   /students/test-prep-v2/question-renderer-accessible.js
//
// If the Test Prep renderer changes, update the version below. Do not add renderer logic here.

export * from '../test-prep-v2/question-renderer-accessible.js?v=2.25.93';
