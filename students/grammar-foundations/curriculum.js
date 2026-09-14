const choice=(id,prompt,choices,answer,extra={})=>({id,masteryKey:`foundation:${id}`,skill:'grammar',form:'choice',prompt,context:{},choices,answer:[String(answer)],input:{language:'en',partCount:1,multiline:false},grading:{constraints:{}},tracking:{practiceType:'grammar_foundations',questionType:'foundation_choice',targets:['be_present']},metadata:{foundation:true,...extra}});
const write=(id,prompt,answer,extra={})=>({id,masteryKey:`foundation:${id}`,skill:'grammar',form:'write',prompt,context:{},choices:[],answer:[answer],input:{language:'en',partCount:1,multiline:false},grading:{constraints:{}},tracking:{practiceType:'grammar_foundations',questionType:'foundation_write',targets:['be_present']},metadata:{foundation:true,...extra}});

export const BE_PRESENT={
  id:'be_present',
  title:'Be Verb — Present',
  koreanTitle:'현재형 be동사',
  lesson:'Lesson 1',
  stages:[
    {
      id:'be-1',number:1,title:'Match the subject',subtitle:'I → am · he/she/it → is · you/we/they → are',
      guide:{rule:'주어에 맞는 be동사를 고르세요.',examples:['I am ready.','She is happy.','They are students.']},
      questions:[
        choice('be1-01','I ___ a student.',['am','is','are'],1),choice('be1-02','She ___ my friend.',['am','is','are'],2),choice('be1-03','They ___ at school.',['am','is','are'],3),choice('be1-04','We ___ ready.',['am','is','are'],3),choice('be1-05','He ___ hungry.',['am','is','are'],2),choice('be1-06','You ___ very kind.',['am','is','are'],3),choice('be1-07','It ___ cold today.',['am','is','are'],2),choice('be1-08','My parents ___ busy.',['am','is','are'],3),choice('be1-09','Jina ___ thirteen years old.',['am','is','are'],2),choice('be1-10','I ___ from Korea.',['am','is','are'],1)
      ]
    },
    {
      id:'be-2',number:2,title:'Positive sentences',subtitle:'Make normal be-verb sentences',
      guide:{rule:'주어 + be동사 + 보어 순서로 긍정문을 만드세요.',examples:['I am tired.','Tom is tall.','The books are new.']},
      questions:[
        write('be2-01','빈칸에 알맞은 be동사를 쓰세요: I ___ tired.','am'),write('be2-02','빈칸에 알맞은 be동사를 쓰세요: Mina ___ at home.','is'),write('be2-03','빈칸에 알맞은 be동사를 쓰세요: The dogs ___ cute.','are'),choice('be2-04','Choose the correct sentence.',['She are happy.','She is happy.','She am happy.'],2),choice('be2-05','Choose the correct sentence.',['We is classmates.','We am classmates.','We are classmates.'],3),write('be2-06','빈칸에 알맞은 be동사를 쓰세요: My bag ___ heavy.','is'),write('be2-07','빈칸에 알맞은 be동사를 쓰세요: You ___ early.','are'),choice('be2-08','Choose the correct sentence.',['I am busy.','I is busy.','I are busy.'],1),write('be2-09','빈칸에 알맞은 be동사를 쓰세요: This book ___ interesting.','is'),write('be2-10','빈칸에 알맞은 be동사를 쓰세요: My friends ___ outside.','are')
      ]
    },
    {
      id:'be-3',number:3,title:'Negative sentences',subtitle:'am not · is not · are not',
      guide:{rule:'be동사 뒤에 not을 붙이면 부정문이 됩니다.',examples:['I am not tired.','He is not angry.','We are not late.']},
      questions:[
        choice('be3-01','I ___ not sleepy.',['am','is','are'],1),choice('be3-02','She ___ not my sister.',['am','is','are'],2),choice('be3-03','They ___ not late.',['am','is','are'],3),write('be3-04','빈칸을 완성하세요: He ___ not busy.','is'),write('be3-05','빈칸을 완성하세요: We ___ not hungry.','are'),choice('be3-06','Choose the correct negative sentence.',['I am not ready.','I not am ready.','I are not ready.'],1),choice('be3-07','Choose the correct negative sentence.',['It are not hot.','It is not hot.','It not is hot.'],2),write('be3-08','빈칸을 완성하세요: You ___ not wrong.','are'),write('be3-09','빈칸을 완성하세요: My parents ___ not home.','are'),choice('be3-10','Choose the correct sentence.',['Tom is not sad.','Tom not is sad.','Tom are not sad.'],1)
      ]
    },
    {
      id:'be-4',number:4,title:'Questions',subtitle:'Am / Is / Are + subject ...?',
      guide:{rule:'의문문은 be동사를 문장 맨 앞으로 보냅니다.',examples:['Are you ready?','Is she your teacher?','Am I late?']},
      questions:[
        choice('be4-01','___ you tired?',['Am','Is','Are'],3),choice('be4-02','___ she at school?',['Am','Is','Are'],2),choice('be4-03','___ I late?',['Am','Is','Are'],1),write('be4-04','빈칸에 알맞은 be동사를 쓰세요: ___ they friends?','Are'),write('be4-05','빈칸에 알맞은 be동사를 쓰세요: ___ he your brother?','Is'),choice('be4-06','Choose the correct question.',['Are you okay?','You are okay?','Is you okay?'],1),choice('be4-07','Choose the correct question.',['She is happy?','Is she happy?','Are she happy?'],2),write('be4-08','빈칸을 완성하세요: ___ it cold outside?','Is'),write('be4-09','빈칸을 완성하세요: ___ we early?','Are'),choice('be4-10','Choose the correct question.',['Am I right?','I am right?','Are I right?'],1)
      ]
    },
    {
      id:'be-5',number:5,title:'Mixed school style',subtitle:'Positive · negative · questions · error spotting',
      guide:{rule:'긍정문, 부정문, 의문문을 섞어서 구별해 보세요.',examples:['He is kind.','He is not kind.','Is he kind?']},
      questions:[
        choice('be5-01','Which sentence is correct?',['My sister are kind.','My sister is kind.','My sister am kind.'],2),choice('be5-02','Which sentence is NOT correct?',['They are busy.','We are ready.','He are tall.'],3),choice('be5-03','Choose the correct question.',['Are your parents home?','Is your parents home?','Your parents are home?'],1),choice('be5-04','Choose the correct negative sentence.',['She is not angry.','She not is angry.','She are not angry.'],1),choice('be5-05','Which pair is correct?',['I–is / he–am','I–am / they–are','she–are / we–is'],2),choice('be5-06','Choose the sentence with the correct word order.',['Is hungry he?','He hungry is.','He is hungry.'],3),choice('be5-07','Which sentence is correct?',['Are this your book?','Is this your book?','Am this your book?'],2),choice('be5-08','Which sentence is NOT correct?',['The cats are cute.','My teacher is nice.','I is thirteen.'],3),choice('be5-09','Choose the best answer: “___ your shoes new?”',['Am','Is','Are'],3),choice('be5-10','Choose the best answer: “No, I ___ not tired.”',['am','is','are'],1)
      ]
    }
  ]
};

export const FOUNDATION_MODULES=[BE_PRESENT];
