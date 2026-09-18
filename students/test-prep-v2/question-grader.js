// Backward-compatible grading entry point for older Test Prep / Renderer Lab builds.
// Canonical grading now lives in students/shared/question-grader.js.
export { gradeQuestion, resolveQuestionGradingPolicy } from '../shared/question-grader.js?v=2.0.1';
