(function(){
'use strict';
const BASE='/Teachers/wrong-print-editor/';
function urlFor(ctx={},autoPdf=false){const q=new URLSearchParams();if(ctx.studentId)q.set('student_id',ctx.studentId);if(ctx.planId)q.set('plan_id',ctx.planId);if(ctx.student)q.set('student',ctx.student);if(ctx.exam)q.set('exam',ctx.exam);if(autoPdf)q.set('auto_pdf','1');return `${BASE}?${q.toString()}`}
function openEditor(ctx){window.open(urlFor(ctx,false),'_blank','noopener')}
function makePdf(ctx){window.open(urlFor(ctx,true),'_blank','noopener')}
window.NaesinV2Print={openEditor,makePdf,version:'r9-p7'};
})();
