// Library-only EN / 한국어 / bilingual display. Never translate stored values or student names.
const translations={
 "Willena Library":"윌레나 도서관","WILLENA LIBRARY":"윌레나 도서관","Teacher workspace":"교직원 업무 공간","Teacher":"교사","Admin":"관리자","Library":"도서관",
 "Checking staff login…":"교직원 로그인 확인 중…","Retry":"다시 시도","Unable to verify login. Retry.":"로그인을 확인할 수 없습니다. 다시 시도해 주세요.",
 "Raz-Kids":"라즈키즈","Monthly reading awards":"월간 독서 시상","Month":"월","Monthly reports":"월간 활동 기록","Import CSV":"CSV 가져오기",
 "Drag & drop your Raz-Kids CSV files here":"라즈키즈 CSV 파일을 여기에 끌어다 놓으세요","or click to browse · multiple CSVs supported":"또는 클릭하여 파일 선택 · 여러 파일 가능","Choose Raz-Kids CSV files or drop them here":"라즈키즈 CSV 파일을 선택하거나 여기에 끌어다 놓으세요",
 "Reading results":"독서 활동 결과","All classes":"전체 반","Find a student":"학생 검색","Class":"반","Find student":"학생 검색","Student":"학생","Listen × 1 · Read × 1 · Recording × 3":"듣기 × 1 · 읽기 × 1 · 녹음 × 3",
 "Book Prizes":"독서상","Review monthly winners and prepare certificates.":"월간 수상자를 확인하고 상장을 준비하세요.","Prepare monthly prizes":"월간 수상자 선정","Gold prize PDF":"금상 PDF","Silver prize PDF":"은상 PDF",
 "Import Raz-Kids":"라즈키즈 가져오기","Close":"닫기","Confirm links & import":"학생 연결 확인 및 가져오기","Prepare Book Prizes":"독서상 준비",
 "Imported students":"가져온 학생 수","Active readers":"활동 학생 수","Reading points":"독서 점수","Rank":"순위","Listen":"듣기","Read":"읽기","Rec.":"녹음","Points":"점수","Through":"기록 종료일",
 "Review":"확인 필요","Multiple accounts":"계정 중복","Not imported":"미등록","No matching students":"검색 결과가 없습니다.","Imported":"가져오기 완료","Unknown":"알 수 없음","Unassigned":"미배정","Unnamed":"이름 없음","Inactive student":"비활성 학생",
 "Gold":"금상","Silver":"은상","Prize":"수상","No prizes selected":"선정된 수상자가 없습니다.","Select Prepare monthly prizes to calculate candidates.":"월간 수상자 선정을 눌러 후보자를 계산하세요.",
 "Loading…":"불러오는 중…","Saving…":"저장 중…","Maximum 30 CSVs":"CSV 파일은 최대 30개까지 가능합니다.","File too large":"파일 용량이 너무 큽니다.","Files parsed. Review labels and new matches.":"파일을 읽었습니다. 계정 이름과 새 학생 연결을 확인해 주세요.",
 "Upload Student Usage CSV files":"학생 활동 CSV 파일 업로드","Select all downloaded teacher-account reports.":"다운로드한 교사 계정별 CSV 파일을 모두 선택하세요.",
 "Remove":"삭제","Raz-Kids teacher account label":"라즈키즈 교사 계정 이름","Same account label each month":"매월 동일한 계정 이름 사용","Report from":"기록 시작일","Report through":"기록 종료일",
 "Confirm suggested links, or select the correct student. Skip unresolved accounts.":"추천 연결을 확인하거나 올바른 학생을 선택하세요. 확인되지 않은 계정은 건너뛰세요.",
 "Raz-Kids account":"라즈키즈 계정","Willena student":"윌레나 학생","Skip":"건너뛰기","Choose student":"학생 선택","All student accounts already linked.":"모든 학생 계정이 이미 연결되어 있습니다.",
 "Reports must begin on the first day of the month. Re-importing replaces the same account’s monthly snapshot, never adds points. Confirming saves new links permanently.":"기록 시작일은 매월 1일이어야 합니다. 다시 가져오면 같은 계정의 월간 기록이 갱신되며 점수가 중복 합산되지 않습니다. 확인하면 새로운 학생 연결이 저장됩니다.",
 "No records selected":"선택한 기록이 없습니다.","Enter the Raz-Kids teacher account label for every file":"모든 파일에 라즈키즈 교사 계정 이름을 입력하세요.","Report must start on day 1 and finish in the same month":"기록은 해당 월 1일에 시작하고 같은 달에 종료해야 합니다.","Match or skip every unresolved student":"미연결 학생을 연결하거나 건너뛰기를 선택하세요.","Import one month at a time":"한 달씩 가져와 주세요.",
 "Minimum Gold points":"금상 최소 점수","Minimum Silver points":"은상 최소 점수","Promote top Silver qualifier when no Gold qualifier":"금상 기준 충족자가 없으면 은상 최고점 학생을 금상으로 승급",
 "Default thresholds and promotion are inferred from past awards. Adjust and recalculate before confirming.":"기본 점수 기준 및 승급 규칙은 기존 시상 기록을 참고했습니다. 확정 전에 수정하고 다시 계산할 수 있습니다.",
 "Recalculate winners":"수상자 다시 계산","Gold recipients":"금상 수상자","Silver recipients":"은상 수상자","No qualifying winners. Adjust thresholds or add recipients.":"기준을 충족하는 수상자가 없습니다. 점수 기준을 조정하거나 수상자를 추가하세요.",
 "Choose class":"반 선택","Additional student":"추가 학생","Choose class first":"먼저 반을 선택하세요","Add Gold":"금상 추가","Add Silver":"은상 추가","Confirm awards":"수상자 확정",
 "Enter valid thresholds: Gold ≥ Silver ≥ 1":"올바른 기준을 입력하세요: 금상 ≥ 은상 ≥ 1","Replace this draft with calculated winners?":"현재 명단을 다시 계산한 수상자로 변경하시겠습니까?","Winners recalculated.":"수상자를 다시 계산했습니다.",
 "Confirm an empty awards list?":"수상자 없이 확정하시겠습니까?","Replace previously confirmed awards for this month?":"이번 달에 이미 확정한 수상자 명단을 변경하시겠습니까?","Awards confirmed. Prepare Gold and Silver PDFs.":"수상자 확정 완료. 금상 및 은상 PDF를 준비하세요.",
 "Print / Save Gold PDF":"금상 PDF 인쇄 / 저장","Print / Save Silver PDF":"은상 PDF 인쇄 / 저장","Back to Library":"도서관으로 돌아가기","A4 portrait · one recipient per page · choose Save as PDF":"A4 세로 · 수상자당 한 페이지 · PDF로 저장 선택",
 "Library API unavailable":"도서관 서버에 연결할 수 없습니다.","Request failed":"요청에 실패했습니다.","Teacher login required":"교직원 로그인이 필요합니다.","Approved staff only":"승인된 교직원만 이용할 수 있습니다.","Staff access denied":"교직원 접근 권한이 없습니다.","Staff permission check unavailable":"교직원 권한을 확인할 수 없습니다.","Library service unavailable":"도서관 서비스를 사용할 수 없습니다.","Upload too large":"업로드 용량이 너무 큽니다.","Invalid JSON":"잘못된 요청 형식입니다.","Invalid month":"잘못된 월입니다.","Invalid award list":"잘못된 수상자 명단입니다.","Invalid or duplicate recipient":"잘못되었거나 중복된 수상자입니다.","Recipient is no longer an active student":"수상자가 현재 재원생이 아닙니다.",
 "Expected the original Raz-Kids Student Usage CSV":"라즈키즈에서 다운로드한 원본 학생 활동 CSV 파일을 사용하세요.","CSV must contain 1–500 student rows":"CSV에는 학생 기록이 1~500개 있어야 합니다.","Unclosed quoted CSV field":"CSV 따옴표 형식이 잘못되었습니다.","Gold minimum must be at least Silver; Silver must be positive":"금상 최소 점수는 은상 이상이어야 하며 은상은 1점 이상이어야 합니다.","Use a report starting on the first of the month and ending within that month.":"해당 월 1일부터 같은 달 종료일까지의 기록을 사용하세요.","Duplicate or unmatched account":"중복되거나 연결되지 않은 계정입니다.","Select up to 30 CSV files":"CSV 파일을 최대 30개 선택하세요."
};
const months={January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
const dateText=t=>t.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\b/g,(_,m,y)=>y+'년 '+months[m]+'월');
const patterns=[
 [/^(\d+) students have multiple account reports; excluded from automatic ranking until reviewed\.$/,m=>m[1]+'명의 학생에게 계정 중복 기록이 있습니다. 확인 전까지 자동 순위에서 제외됩니다.'],
 [/^No reports imported for (.+)\.$/,m=>dateText(m[1])+'에 가져온 기록이 없습니다.'],
 [/^Confirmed · (\d+) Gold · (\d+) Silver$/,m=>'확정 · 금상 '+m[1]+'명 · 은상 '+m[2]+'명'],
 [/^(.+) · (\d+) student records$/,m=>m[1]+' · 학생 기록 '+m[2]+'개'],
 [/^(\d+) records · (\d+) already linked$/,m=>'기록 '+m[1]+'개 · '+m[2]+'개 연결 완료'],
 [/^Imported (\d+) records\.(?: (\d+) older reports ignored\.)?$/,m=>'기록 '+m[1]+'개 가져오기 완료.'+(m[2]?' 이전 기록 '+m[2]+'개 제외.':'')],
 [/^(.+) · Class winners, including ties$/,m=>dateText(m[1])+' · 반별 수상자 (공동 수상 포함)'],
 [/^(\d+) students have no single imported result\. (Report end dates differ\. )?Check coverage before issuing prizes\.$/,m=>m[1]+'명의 학생에게 유효한 단일 기록이 없습니다. '+(m[2]?'기록 종료일이 서로 다릅니다. ':'')+'시상 전에 기록을 확인하세요.'],
 [/^Incorrect columns in row (\d+)$/,m=>'CSV '+m[1]+'행의 열 개수가 올바르지 않습니다.'],
 [/^Missing account name in row (\d+)$/,m=>'CSV '+m[1]+'행에 계정 이름이 없습니다.'],
 [/^Duplicate account in row (\d+)$/,m=>'CSV '+m[1]+'행에 중복 계정이 있습니다.'],
 [/^Invalid (.+) in row (\d+)$/,m=>'CSV '+m[2]+'행의 '+m[1]+' 값이 올바르지 않습니다.'],
 [/^Skip (.+)$/,m=>m[1]+' 건너뛰기'],
 [/^(Gold|Silver) prize certificates$/,m=>(m[1]==='Gold'?'금상':'은상')+' 상장'],
 [/^Could not save or load library records \((\d+)\)\. Check account links and retry\.$/,m=>'도서관 기록을 저장하거나 불러올 수 없습니다 ('+m[1]+'). 계정 연결을 확인하고 다시 시도하세요.']
];
let mode='en';try{const saved=localStorage.getItem('willena.library.language');if(['en','ko','both'].includes(saved))mode=saved}catch{}
function korean(t){if(Object.prototype.hasOwnProperty.call(translations,t))return translations[t];for(const [re,fn] of patterns){const m=t.match(re);if(m)return fn(m)}return null}
export function localText(value){const raw=String(value??'');if(mode==='en'||!raw.trim())return raw;const key=raw.trim(),ko=korean(key);if(!ko)return raw;const localized=mode==='ko'?ko:key+' / '+ko;return raw.replace(key,()=>localized)}
const nodes=new WeakMap(),attrs=new WeakMap();
function applyText(node){const parent=node.parentElement;if(!parent||parent.closest('[data-no-translate],script,style,textarea,.certificate,.library-language'))return;const current=node.nodeValue;let entry=nodes.get(node);if(!entry||current!==entry.last)entry={original:current,last:current};const next=localText(entry.original);entry.last=next;nodes.set(node,entry);if(current!==next)node.nodeValue=next}
function applyAttrs(el){if(el.closest('[data-no-translate],.certificate,.library-language'))return;let saved=attrs.get(el)||{};for(const attr of ['placeholder','aria-label','title']){if(!el.hasAttribute(attr))continue;const current=el.getAttribute(attr);let entry=saved[attr];if(!entry||current!==entry.last)entry={original:current,last:current};const next=localText(entry.original);entry.last=next;saved[attr]=entry;if(current!==next)el.setAttribute(attr,next)}attrs.set(el,saved)}
function roots(){return ['#app','#boot','#importDialog','#awardDialog','#classAwardsPrintOverlay .award-toolbar','#teacher-header .th-switch','#teacher-header .th-brand-copy small'].map(x=>document.querySelector(x)).filter(Boolean)}
let observer=null;let pending=false;
function refresh(){pending=false;observer?.disconnect();document.documentElement.dataset.libraryLanguage=mode;document.documentElement.lang=mode==='ko'?'ko':'en';for(const root of roots()){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode())applyText(n);applyAttrs(root);for(const el of root.querySelectorAll('[placeholder],[aria-label],[title]'))applyAttrs(el);observer?.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']})}observer?.observe(document.body,{childList:true});document.querySelectorAll('.library-language button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===mode)))}
function queueRefresh(){if(!pending){pending=true;queueMicrotask(refresh)}}
export function initLibraryLanguage(){if(!observer)observer=new MutationObserver(queueRefresh);refresh()}
export function mountLibraryLanguage(root){if(!root)return;let group=root.querySelector('.library-language');if(!group){group=document.createElement('div');group.className='library-language';group.setAttribute('role','group');group.setAttribute('aria-label','Language / 언어');for(const [lang,title,desc] of [['en','EN','English'],['ko','한국어','한국어'],['both','EN+한','English + 한국어']]){const b=document.createElement('button');b.type='button';b.dataset.lang=lang;b.textContent=title;b.title=desc;b.addEventListener('click',()=>{mode=lang;try{localStorage.setItem('willena.library.language',mode)}catch{}refresh()});group.append(b)}const actions=root.querySelector('.th-actions');if(actions)actions.prepend(group);else root.append(group)}refresh()}
