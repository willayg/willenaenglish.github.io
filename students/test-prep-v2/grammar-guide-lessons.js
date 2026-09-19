import {GUIDES} from './grammar-guide.js?v=2.1.2';

const g=(title,summary,formula,sections,exam,memory)=>({title,summary,formula,sections,exam,memory});
const ex=(prompt,choices,answer,explanation)=>({prompt,choices,answer,explanation});

Object.assign(GUIDES,{
  'to-infinitive-purpose':g('목적을 나타내는 to부정사','어떤 행동을 왜 하는지 목적을 설명할 때 to + 동사원형을 사용해요. 문장 속에서 “~하기 위해”로 해석되는지 확인하면 좋아요.','to + V = ~하기 위해',[
    {title:'기본 쓰임',examples:[['to study','I went to the library to study.','나는 공부하기 위해 도서관에 갔다.'],['to help','She called me to help her.','그녀는 도움을 받기 위해 나에게 전화했다.']]},
    {title:'위치',note:'목적의 to부정사는 보통 행동 뒤에 와서 그 행동의 이유를 설명해요. 문장 앞에 올 수도 있지만 중학교 시험에서는 뒤에 오는 형태가 가장 흔해요.'},
    {title:'명사적 용법과 구별',table:[['I want to travel.','travel은 want의 목적어'],['I saved money to travel.','travel은 돈을 모은 목적']]},
    {title:'시험 함정',note:'to + 동사원형이라는 모양만 보고 용법을 판단하지 마세요. 앞 동사의 목적어인지, 앞 행동의 목적을 설명하는지 문장 전체 뜻을 봐야 해요.'}
  ],ex('She went outside ___ some fresh air.',['① get','② to get','③ getting'],'② to get','밖에 나간 목적이 “신선한 공기를 마시기 위해”이므로 목적을 나타내는 to부정사예요.'),[['뜻','~하기 위해'],['형태','to + 동사원형'],['판단','앞 행동의 목적을 설명하는지 확인']]),

  'dummy-it':g('가주어 it','긴 to부정사 주어를 문장 뒤로 보내고 앞에 it을 두는 표현이에요. it 자체에는 특별한 뜻이 없고 진짜 내용은 뒤의 to부정사예요.','It + be + 형용사 + to V',[
    {title:'기본 구조',examples:[['easy','It is easy to use this app.','이 앱을 사용하는 것은 쉽다.'],['important','It is important to get enough sleep.','충분히 자는 것은 중요하다.']]},
    {title:'원래 문장과 비교',table:[['To learn English is useful.','It is useful to learn English.'],['To keep promises is important.','It is important to keep promises.']]},
    {title:'자주 쓰는 형용사',table:[['easy / difficult','쉽다 / 어렵다'],['important','중요하다'],['good / helpful','좋다 / 도움이 된다'],['dangerous','위험하다']]},
    {title:'시험 함정',note:'가주어 it과 날씨·시간의 it을 구별하세요. 뒤에 to부정사가 진짜 주어로 따라오면 가주어일 가능성이 높아요.'}
  ],ex('___ is important to follow the rules.',['① It','② This','③ There'],'① It','It is + 형용사 + to V 구조에서 it은 가주어이고 to follow the rules가 진짜 내용이에요.'),[['형태','It is + adj + to V'],['진짜 주어','뒤의 to V'],['it','특별한 뜻 없음']]),

  'superlatives':g('최상급','셋 이상 중에서 “가장 ~한” 대상을 말할 때 최상급을 사용해요. 형태뿐 아니라 the와 범위 표현도 함께 확인해야 해요.','the + 최상급 + 범위',[
    {title:'기본 변화',table:[['tall','the tallest'],['busy','the busiest'],['big','the biggest'],['beautiful','the most beautiful'],['good','the best']]},
    {title:'범위 표현',examples:[['in','Jin is the tallest in the class.','진은 반에서 가장 키가 크다.'],['of','This is the best of the three.','이것이 셋 중 가장 좋다.']]},
    {title:'불규칙 변화',table:[['good / well','best'],['bad / badly','worst'],['many / much','most']]},
    {title:'시험 함정',note:'최상급 앞에는 보통 the가 와요. 비교 대상이 둘이면 비교급, 셋 이상 또는 전체 범위에서 하나를 고르면 최상급을 의심하세요.'}
  ],ex('Mt. Everest is ___ mountain in the world.',['① higher','② the highest','③ the higher'],'② the highest','in the world라는 전체 범위에서 가장 높은 산을 말하므로 최상급이 필요해요.'),[['셋 이상','최상급'],['형태','the + -est / most'],['불규칙','good → best']]),

  'comparative-correlative':g('비교급 특수 표현','비교급이 반복되거나 서로 연결되어 “점점 더 ~” 또는 “~할수록 더 ~”의 뜻을 만드는 표현이에요.','비교급 and 비교급 / The 비교급, the 비교급',[
    {title:'점점 더',pattern:'비교급 + and + 비교급',examples:[['short','The days are getting shorter and shorter.','날이 점점 더 짧아지고 있다.'],['more','The city became more and more crowded.','도시는 점점 더 붐비게 되었다.']]},
    {title:'~할수록 더 ~',pattern:'The + 비교급 ..., the + 비교급 ...',examples:[['practice','The more you practice, the better you become.','연습을 많이 할수록 더 잘하게 된다.']]},
    {title:'긴 형용사',note:'긴 형용사는 more and more + 형용사 형태를 써요. more beautiful and more beautiful보다 more and more beautiful이 자연스러워요.'},
    {title:'시험 함정',note:'앞의 the를 관사로 해석하지 마세요. The 비교급, the 비교급 구조에서는 “~할수록”이라는 고정 표현의 일부예요.'}
  ],ex('The more you read, ___ you understand.',['① the more','② more','③ the most'],'① the more','The 비교급, the 비교급 구조가 필요해요.'),[['점점 더','비교급 and 비교급'],['~할수록','The 비교급, the 비교급']]),

  'simple-past':g('과거시제','과거에 시작하고 끝난 행동이나 상태를 말할 때 과거시제를 써요. 규칙 변화와 불규칙 변화, did 뒤 동사원형을 함께 봐야 해요.','주어 + 과거형',[
    {title:'규칙 변화',table:[['play','played'],['live','lived'],['study','studied'],['stop','stopped']]},
    {title:'불규칙 변화',table:[['go','went'],['see','saw'],['take','took'],['have','had'],['come','came']]},
    {title:'부정문·의문문',table:[['부정','did not + 동사원형'],['의문','Did + 주어 + 동사원형?']]},
    {title:'시간 표현',examples:[['yesterday','I met him yesterday.','나는 어제 그를 만났다.'],['ago','She moved here two years ago.','그녀는 2년 전에 이곳으로 이사 왔다.']]},
    {title:'시험 함정',note:'did가 나오면 본동사는 반드시 원형이에요. did went, did studied처럼 과거형을 또 쓰지 않아요.'}
  ],ex('Did Mina ___ the movie yesterday?',['① watched','② watch','③ watches'],'② watch','Did 뒤에는 동사원형이 와야 해요.'),[['과거','V-ed / 불규칙 과거형'],['did 뒤','동사원형'],['신호','yesterday · last ~ · ago']]),

  'future':g('미래 표현','앞으로 할 일이나 계획을 말할 때 will 또는 be going to를 써요. 둘 다 미래를 나타내지만 문맥에서 계획인지 즉석 결정인지 볼 수 있어요.','will + V / be going to + V',[
    {title:'will',examples:[['prediction','It will rain tomorrow.','내일 비가 올 것이다.'],['decision','I will help you.','내가 도와줄게.']]},
    {title:'be going to',examples:[['plan','We are going to visit Busan.','우리는 부산을 방문할 예정이다.'],['evidence','Look at the clouds. It is going to rain.','구름을 봐. 비가 올 것 같다.']]},
    {title:'형태',table:[['will','will + 동사원형'],['be going to','am/is/are + going to + 동사원형']]},
    {title:'시험 함정',note:'be going to에서 be동사를 빠뜨리지 마세요. She going to study가 아니라 She is going to study예요.'}
  ],ex('We ___ visit my grandmother this weekend.',['① are going to','② going to','③ are go to'],'① are going to','be going to는 be동사 + going to + 동사원형 구조예요.'),[['will','will + V'],['계획','be going to + V'],['주의','be동사 빠뜨리지 않기']]),

  'time-clauses':g('시간 부사절','when, before, after, until 같은 시간 접속사가 이끄는 절이에요. 미래 일을 말해도 시간 부사절 안에서는 현재시제를 쓰는 것이 핵심이에요.','when/before/after + 현재시제, 주절은 미래 가능',[
    {title:'기본 구조',examples:[['when','I will call you when I get home.','집에 도착하면 너에게 전화할게.'],['before','Finish your homework before you go out.','나가기 전에 숙제를 끝내라.']]},
    {title:'미래 의미인데 현재형',table:[['주절','I will call you'],['시간 부사절','when I get home (not will get)']]},
    {title:'자주 나오는 접속사',table:[['when','~할 때'],['before','~하기 전에'],['after','~한 후에'],['until','~할 때까지']]},
    {title:'시험 함정',note:'when 뒤에 무조건 현재형을 쓰는 것은 아니지만, 미래 조건의 시간 부사절에서는 will 대신 현재시제를 쓰는 문제가 매우 자주 나와요.'}
  ],ex('I will text you when I ___ home.',['① will get','② get','③ got'],'② get','미래 일을 말하지만 when이 이끄는 시간 부사절 안에서는 현재시제를 써요.'),[['시간절','when/before/after/until'],['미래 의미','시간절 안은 현재시제'],['주절','will 가능']]),

  'modals':g('조동사','can, will, should 같은 조동사는 동사 앞에 와서 가능, 미래, 충고 같은 뜻을 더해요. 조동사 뒤에는 항상 동사원형이 와요.','조동사 + 동사원형',[
    {title:'대표 의미',table:[['can','~할 수 있다 / ~해도 된다'],['will','~할 것이다'],['should','~해야 한다 / ~하는 것이 좋다'],['must / have to','~해야 한다']]},
    {title:'형태',examples:[['can','She can swim well.','그녀는 수영을 잘할 수 있다.'],['should','You should get some rest.','너는 좀 쉬는 것이 좋다.']]},
    {title:'부정',table:[['cannot / can’t','~할 수 없다'],['should not / shouldn’t','~하면 안 된다 / 하지 않는 것이 좋다'],['will not / won’t','~하지 않을 것이다']]},
    {title:'시험 함정',note:'조동사 뒤에 -s, -ed, to를 붙이지 않아요. He can plays가 아니라 He can play예요.'}
  ],ex('You ___ drink more water if you feel tired.',['① should','② should to','③ should drinking'],'① should','should 뒤에는 동사원형 drink가 바로 와요.'),[['형태','조동사 + V'],['3인칭 단수','조동사 뒤에도 V 그대로'],['부정','조동사 + not + V']]),

  'imperatives':g('명령문','상대에게 행동을 하라고 하거나 하지 말라고 할 때 쓰는 문장이에요. 주어 you는 보통 생략하고 동사원형으로 시작해요.','동사원형 ... / Don’t + 동사원형',[
    {title:'긍정 명령',examples:[['Open','Open the window.','창문을 열어라.'],['Be','Be careful.','조심해라.']]},
    {title:'부정 명령',examples:[['Don’t','Don’t touch that.','그것을 만지지 마라.'],['Don’t be','Don’t be late.','늦지 마라.']]},
    {title:'please',note:'Please를 앞이나 뒤에 붙이면 더 공손한 부탁이 돼요. Please sit down. / Sit down, please.'},
    {title:'시험 함정',note:'명령문은 주어 없이 동사원형으로 시작해요. Be careful에서 be도 원형이라는 점을 기억하세요.'}
  ],ex('___ quiet in the library.',['① Be','② Is','③ Being'],'① Be','명령문은 동사원형으로 시작하므로 Be가 맞아요.'),[['긍정','V로 시작'],['부정','Don’t + V'],['be동사 명령','Be + 형용사']]),

  'there-be':g('There is / There are','어떤 것이 “있다”라고 존재를 말할 때 쓰는 표현이에요. 뒤에 오는 명사의 수에 따라 is/are가 달라져요.','There is + 단수 / There are + 복수',[
    {title:'단수와 복수',examples:[['singular','There is a book on the desk.','책상 위에 책 한 권이 있다.'],['plural','There are three books on the desk.','책상 위에 책 세 권이 있다.']]},
    {title:'부정문',table:[['단수','There is not / isn’t ...'],['복수','There are not / aren’t ...']]},
    {title:'의문문',table:[['단수','Is there ...?'],['복수','Are there ...?']]},
    {title:'시험 함정',note:'문장 앞의 there가 아니라 뒤의 실제 명사를 보고 is/are를 결정하세요.'}
  ],ex('There ___ two cats under the table.',['① is','② are','③ be'],'② are','뒤의 명사 two cats가 복수이므로 are를 써요.'),[['단수','There is'],['복수','There are'],['의문','Is/Are there ...?']]),

  'linking-verbs':g('감각·연결동사 + 형용사','look, sound, smell, taste, feel 같은 동사 뒤에서는 주어의 상태를 설명하는 형용사가 와요. 행동을 꾸미는 부사와 구별하는 것이 핵심이에요.','look / sound / smell / taste / feel + adjective',[
    {title:'감각동사',examples:[['look','You look tired.','너는 피곤해 보인다.'],['sound','That sounds great.','그것은 멋지게 들린다.'],['smell','The soup smells good.','수프에서 좋은 냄새가 난다.']]},
    {title:'형용사 vs 부사',table:[['She looks happy.','상태 → 형용사'],['She sings happily.','행동 방식 → 부사']]},
    {title:'become',examples:[['become','The sky became dark.','하늘이 어두워졌다.']]},
    {title:'시험 함정',note:'look carefully는 “주의 깊게 보다”라서 부사 carefully, look happy는 “행복해 보이다”라서 형용사 happy예요. 동사의 의미를 먼저 확인하세요.'}
  ],ex('The music sounds ___.',['① beautiful','② beautifully','③ beauty'],'① beautiful','sound가 연결동사로 쓰여 주어 music의 상태를 설명하므로 형용사가 와요.'),[['연결동사 뒤','형용사'],['대표','look · sound · smell · taste · feel'],['구별','행동을 꾸미면 부사']]),

  'perception-verbs':g('지각동사','see, hear, watch, feel 같은 지각동사는 목적어 뒤에 동사원형이나 -ing 형태를 둘 수 있어요. 시험에서는 목적격보어의 형태를 묻는 경우가 많아요.','지각동사 + 목적어 + V / V-ing',[
    {title:'동사원형',examples:[['see','I saw him cross the street.','나는 그가 길을 건너는 것을 보았다.'],['hear','We heard her sing.','우리는 그녀가 노래하는 것을 들었다.']]},
    {title:'-ing',examples:[['see','I saw him crossing the street.','나는 그가 길을 건너고 있는 것을 보았다.']]},
    {title:'의미 차이',table:[['V','행동 전체를 봄/들음'],['V-ing','진행 중인 장면을 봄/들음']]},
    {title:'시험 함정',note:'능동 의미에서는 목적어 뒤에 to부정사를 쓰지 않아요. saw him to cross가 아니라 saw him cross예요.'}
  ],ex('I heard Mina ___ my name.',['① call','② to call','③ called'],'① call','지각동사 hear + 목적어 + 동사원형 구조예요.'),[['구조','see/hear/watch + O + V/V-ing'],['V','행동 전체'],['V-ing','진행 중 장면']]),

  'that-clauses':g('that절','that 뒤에 완전한 문장이 와서 하나의 명사처럼 쓰이는 구조예요. think, know, believe, say 같은 동사의 목적어로 자주 나와요.','동사 + that + 주어 + 동사',[
    {title:'목적어 that절',examples:[['think','I think that he is right.','나는 그가 옳다고 생각한다.'],['know','We know that she works hard.','우리는 그녀가 열심히 일한다는 것을 안다.']]},
    {title:'that 생략',note:'목적어로 쓰인 that은 자주 생략할 수 있어요. I think (that) he is right.'},
    {title:'지시대명사 that과 구별',table:[['I know that he is kind.','접속사 that'],['That is my bag.','지시대명사 that']]},
    {title:'시험 함정',note:'접속사 that 뒤에는 주어 + 동사가 있는 완전한 절이 와요. 뒤 구조를 보고 that의 역할을 판단하세요.'}
  ],ex('I believe ___ she can do it.',['① that','② what','③ to'],'① that','believe의 목적어로 완전한 문장 she can do it을 연결하므로 that이 맞아요.'),[['형태','that + 완전한 문장'],['주요 동사','think · know · believe · say'],['목적어 that','생략 가능']]),

  'agreement':g('주어-동사 수일치','주어가 단수인지 복수인지에 따라 동사의 형태를 맞추는 규칙이에요. 긴 주어에서는 동사 바로 앞 단어가 아니라 진짜 주어를 찾아야 해요.','단수 주어 ↔ 단수 동사 / 복수 주어 ↔ 복수 동사',[
    {title:'기본',table:[['He','likes / is'],['They','like / are']]},
    {title:'긴 주어',examples:[['of phrase','The color of these bags is nice.','이 가방들의 색은 좋다.'],['with phrase','Mina with her friends is here.','친구들과 함께 온 미나는 여기 있다.']]},
    {title:'each / every',examples:[['each','Each student has a book.','각 학생은 책 한 권을 가지고 있다.'],['every','Every room is clean.','모든 방이 깨끗하다.']]},
    {title:'시험 함정',note:'of 뒤의 복수명사에 끌리지 마세요. The number of students is ...처럼 핵심 주어가 단수면 동사도 단수예요.'}
  ],ex('The color of the walls ___ bright.',['① are','② is','③ be'],'② is','주어의 중심은 color이므로 단수 동사 is가 맞아요.'),[['핵심','진짜 주어 찾기'],['each/every','단수 취급'],['of 뒤 명사','주어가 아닐 수 있음']]),

  'reflexive':g('재귀대명사','주어와 목적어가 같은 사람·사물일 때 myself, yourself, himself 같은 재귀대명사를 써요. 강조 용법도 시험에 자주 나와요.','myself · yourself · himself · herself · itself · ourselves · yourselves · themselves',[
    {title:'형태',table:[['I','myself'],['you','yourself / yourselves'],['he','himself'],['she','herself'],['we','ourselves'],['they','themselves']]},
    {title:'재귀 용법',examples:[['same person','He hurt himself.','그는 자기 자신을 다쳤다.'],['by oneself','She made it by herself.','그녀는 그것을 혼자 만들었다.']]},
    {title:'강조 용법',examples:[['emphasis','I made this cake myself.','내가 직접 이 케이크를 만들었다.']]},
    {title:'시험 함정',note:'주어와 목적어가 같은지 먼저 확인하세요. Mina likes her는 다른 여자를 뜻할 수 있지만 Mina likes herself는 Mina 자신을 뜻해요.'}
  ],ex('Jina looked at ___ in the mirror.',['① her','② herself','③ she'],'② herself','거울을 본 사람과 거울 속 대상이 같은 Jina이므로 재귀대명사 herself가 필요해요.'),[['같은 대상','재귀대명사'],['혼자','by oneself'],['강조','주어/목적어 뒤에 재귀대명사']])
});
