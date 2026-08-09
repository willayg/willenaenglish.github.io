(function(global){
'use strict';
var URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
var KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
var HEADERS={apikey:KEY,Authorization:'Bearer '+KEY};
var ALLOWED={grammar:'grammar',grammar_error:'grammar',grammar_application:'grammar',question_response:'conversation',vocabulary:'vocabulary',listening:'listening',sentence_unscramble:'sentence_building'};
function arr(v){return Array.isArray(v)?v:[];}
function text(v){return String(v==null?'':v).trim();}
async function get(path){var r=await fetch(URL+'/rest/v1/'+path,{headers:HEADERS,cache:'no-store'});if(!r.ok)throw new Error('Question bank '+r.status);return r.json();}
function optionTexts(row){return arr(row.choices).map(function(x){return typeof x==='string'?x:text(x&&x.text||x&&x.option_text);}).filter(Boolean);}
function answer(row){var a=row.correct_answer;if(typeof a==='string'||typeof a==='number')return String(a);if(a&&typeof a==='object')return text(a.text||a.answer||a.value);return'';}
function mapRow(row,context){var skill=ALLOWED[text(row.item_type)];if(!skill)return null;var choices=optionTexts(row),correct=answer(row);if(correct&&choices.indexOf(correct)<0)choices=choices.concat([correct]);if(!correct||choices.length<2)return null;var meta=row.metadata||{};return{id:'assessment-'+row.id,sourceType:'assessment_item',sourceId:row.id,skill:skill,usage:['practice','level_test'],stimulus:{type:'text',prompt:text(row.prompt_text),context:text(row.context_text)||(skill==='conversation'?'가장 알맞은 응답을 고르세요.':'알맞은 답을 고르세요.')},response:{type:'multiple_choice',choices:choices},answer:correct,level:Number(row.level_id)||null,difficulty:Number(row.difficulty_rating)||null,metadata:{book_id:context.bookId,unit_id:context.unitId,pool_source:'assessment_bank',source_label:'Approved level bank',assessment_item_type:row.item_type,bank_level_id:Number(row.level_id)||null,authored:true,practice_bank:true,pattern_code:meta.pattern_code||null}};}
async function resolveBankLevel(publicLevel,context){if(!publicLevel)return null;var bookId=context&&context.bookId;if(bookId){try{var books=await get('content_books?select=internal_level_id,public_level&id=eq.'+encodeURIComponent(bookId)+'&status=in.(review,published)&limit=1');if(books.length){var internal=Number(books[0].internal_level_id)||null,pub=Number(books[0].public_level)||Number(publicLevel);if(internal&&internal<=2)return internal;if(pub)return pub+2;}}catch(_){}}
return Number(publicLevel)+2;
}
async function loadLevel(publicLevel,context){var bankLevel=await resolveBankLevel(publicLevel,context||{});if(!bankLevel)return[];var select='id,level_id,difficulty_rating,item_type,prompt_text,context_text,correct_answer,metadata,choices';var path='assessment_items?select='+encodeURIComponent(select)+'&level_id=eq.'+encodeURIComponent(bankLevel)+'&status=eq.published&is_flagged=eq.false&order=difficulty_rating.asc,source_key.asc';var rows=await get(path);return arr(rows).map(function(r){return mapRow(r,context||{});}).filter(Boolean);}
global.WillenaStudyQuestionBank={version:'authored-bank-v3',loadLevel:loadLevel};
})(window);
