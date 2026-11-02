// Shared Grammar Genius engine adapter. No lesson content is loaded in the books shell yet.
import {QuestionRenderer} from '../shared/student-question-renderer.js?v=20261025-shared-unified-v1';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
export const grammarEngine={QuestionRenderer,gradeQuestion};
