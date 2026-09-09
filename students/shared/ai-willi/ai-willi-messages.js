export const AI_WILLI_NAME='AI Willi';

export const AI_WILLI_MESSAGES={
  grader:{
    idle:'AI Willi로 확인',
    waiting:'AI Willi가 답을 확인하고 있어요…',
    failed:'AI Willi가 답을 확인하지 못했어요. 다시 시도해 주세요.'
  },
  helper:{
    idle:'AI Willi에게 물어보기',
    waiting:'AI Willi가 생각하고 있어요…',
    failed:'AI Willi가 지금 답하지 못했어요. 다시 시도해 주세요.'
  }
};

export function aiWilliMessage(role,key){
  return AI_WILLI_MESSAGES?.[role]?.[key]||AI_WILLI_MESSAGES.helper.idle;
}
