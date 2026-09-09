export const AI_WILLI_NAME='AI Willi';

export const AI_WILLI_MESSAGES={
  grader:{
    idle:'AI Willi',
    waiting:'AI Willi is checking your answer…',
    failed:'AI Willi could not check your answer. Please try again.'
  },
  helper:{
    idle:'Ask AI Willi',
    waiting:'AI Willi is thinking…',
    failed:'AI Willi could not help right now. Please try again.'
  }
};

export function aiWilliMessage(role,key){
  return AI_WILLI_MESSAGES?.[role]?.[key]||AI_WILLI_MESSAGES.helper.idle;
}
