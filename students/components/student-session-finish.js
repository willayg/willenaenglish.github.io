// Shared finish-screen markup. Extracted from Word Genius finishSession.
// Callers supply text/stats, reward and gold markup, optional review, and action buttons.
export function renderStudentSessionFinish({
 title='잘했어요!',description='이번 학습이 끝났어요.',stats=[],rewardHtml='',goldHtml='',reviewHtml='',actionsHtml=''
}={}){
 const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 return '<section class="vocab-finish">'+
  '<span class="eyebrow">SESSION COMPLETE</span>'+
  '<h2>'+escape(title)+'</h2>'+
  '<p>'+escape(description)+'</p>'+
  '<div class="vocab-finish-stats">'+stats.map(item=>'<div><strong>'+escape(item.value)+'</strong><span>'+escape(item.label)+'</span></div>').join('')+'</div>'+
  rewardHtml+goldHtml+reviewHtml+
  '<div class="vocab-finish-actions">'+actionsHtml+'</div>'+
 '</section>';
}
