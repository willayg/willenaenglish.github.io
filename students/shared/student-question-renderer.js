// Canonical public import for student apps that render Willena questions.
//
// The implementation currently delegates to Test Prep V2's battle-tested renderer so
// Grammar Foundations can reuse the same rendering behavior without copying it.
// When the renderer implementation is moved fully into /students/shared later, consuming
// apps will not need to change their imports.

export * from '../test-prep-v2/question-renderer-accessible.js?v=2.25.93';
