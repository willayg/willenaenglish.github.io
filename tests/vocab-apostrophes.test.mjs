import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

async function load(path){
  const source=await readFile(new URL('../students/vocab-study/'+path,import.meta.url),'utf8');
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const {matchesSpellingTarget}=await load('spelling-targets.js');
const {matchSpeakingTarget,isSpeakableTarget}=await load('speaking-match.js');

test('spelling accepts equivalent apostrophes in tests and coach, still requires correct spelling',()=>{
  for(const target of ["Tim's",'Tim’s','Timʼs']){
    for(const answer of ["Tim's",'tim’s',' TIM‘S ','Timʼs','Ｔｉｍ＇ｓ']){
      assert.equal(matchesSpellingTarget(answer,target),true,`${answer} / ${target}`);
    }
    for(const answer of ['Tim','Tims',"Tom's","Tim'ss"]){
      assert.equal(matchesSpellingTarget(answer,target),false,answer);
    }
  }
  assert.equal(matchesSpellingTarget('', ''),false);
});

test('speaking ignores unspoken apostrophes before strict AI fallback filtering',()=>{
  for(const target of ["Tim's",'Tim’s']){
    for(const transcript of ['Tims',"Tim's",'Tim’s','TIMS.']){
      const result=matchSpeakingTarget(target,[transcript]);
      assert.equal(result.correct,true);
      assert.equal(result.matchedBy,'exact');
      assert.equal(result.transcript,transcript);
    }
  }
  assert.equal(matchSpeakingTarget("It's Tim's",['Its Tims.']).matchedBy,'exact');
  assert.equal(["exact","spacing","homophone"].includes(matchSpeakingTarget("Tim's",["Tom's"]).matchedBy),false);
  assert.equal(matchSpeakingTarget('sew',['so']).matchedBy,'homophone');
  assert.equal(['exact','spacing','homophone'].includes(matchSpeakingTarget('sew',['shoe']).matchedBy),false);
  assert.equal(matchSpeakingTarget("they’re",['their']).matchedBy,'homophone');
  assert.equal(isSpeakableTarget("'s"),false);
});
