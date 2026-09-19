import {GUIDES} from './grammar-guide.js?v=2.1.1';

const g=(title,summary,formula,sections,exam,memory)=>({title,summary,formula,sections,exam,memory});
const ex=(prompt,choices,answer,explanation)=>({prompt,choices,answer,explanation});

Object.assign(GUIDES,{
  'to-infinitive-purpose':g('목적을 나타내는 to부정사','어떤 행동을 왜 하는지 설명할 때 to + 동사원형을 사용해요. 문장 전체의 행동 목적을 설명하는 부사적 용법이에요.','주절 + to + 동사원형 = ~하기 위해',[
    {title:'기본 의미',examples:[['목적','I went to the library to study.','나는 공부하기 위해 도서관에 갔다.'],['목적','She saved money to buy a laptop.','그녀는 노트북을 사기 위해 돈을 모았다.'],['목적','He called me to ask a question.','그는 질문하기 위해 나에게 전화했다.']]},
    {title:'위치',note:'보통 목적을 설명하는 to부정사는 주절 뒤에 와요. 문장 앞에 올 수도 있지만 중학교 시험에서는 주절 뒤 형태가 가장 흔해요.'},
    {title:'명사적 용법과 구별',examples:[['명사적','I want to study English.','나는 영어를 공부하고 싶다.'],['목적','I went outside to get some air.','나는 바람을 쐬기 위해 밖에 나갔다.']]},
    {title:'시험 함정',note:'앞 동사가 want, hope, plan처럼 to부정사를 목적어로 요구하면 목적 용법이 아니에요. “왜 그 행동을 했는가?”에 답하는지 확인하세요.'}
  ],ex('Mina went to the store ___ some milk.',['① buy','② to buy','③ buying'],'② to buy','가게에 간 목적을 설명하므로 목적을 나타내는 to부정사 to buy가 맞아요.'),[['형태','to + 동사원형'],['판별 질문','왜 했는가?'],['주의','want to V와 구별']]),

  'dummy-it':g('가주어 it','주어가 긴 to부정사일 때 진짜 주어를 뒤로 보내고 문장 앞에 it을 두는 구조예요. it 자체에는 구체적인 뜻이 없어요.','It + be + 형용사 + to V',[
    {title:'기본 구조',examples:[['easy','It is easy to understand this rule.','이 규칙을 이해하는 것은 쉽다.'],['important','It is important to keep promises.','약속을 지키는 것은 중요하다.'],['difficult','It was difficult to solve the problem.','그 문제를 푸는 것은 어려웠다.']]},
    {title:'원래 문장과 비교',table:[['To exercise every day is important.','It is important to exercise every day.'],['To learn a language takes time.','It takes time to learn a language.']]},
    {title:'시제',note:'현재면 It is, 과거면 It was처럼 be동사의 시제는 문맥에 맞춰 바뀔 수 있어요.'},
    {title:'시험 함정',note:'There와 헷갈리지 마세요. There is/are는 존재를 말하고, 가주어 it은 뒤의 to부정사가 진짜 내용이에요.'}
  ],ex('___ is necessary to wear a helmet here.',['① It','② There','③ This'],'① It','뒤의 to wear a helmet이 실제 주어 역할을 하므로 가주어 It을 써요.'),[['형태','It + be + adj + to V'],['it의 역할','뜻 없는 가주어'],['진짜 주어','뒤의 to V']]),

  'superlatives':g('최상급','셋 이상 가운데 가장 높은 정도를 나타낼 때 최상급을 사용해요. 짧은 형용사는 -est, 긴 형용사는 most를 주로 사용해요.','the + 최상급 + 범위',[
    {title:'형태 만들기',table:[['tall','the tallest'],['large','the largest'],['busy','the busiest'],['big','the biggest'],['beautiful','the most beautiful'],['good','the best'],['bad','the worst']]},
    {title:'범위 표현',examples:[['in','Jisu is the tallest in her class.','지수는 반에서 가장 키가 크다.'],['of','This is the best of the three.','이것이 셋 중 가장 좋다.']]},
    {title:'one of + 최상급',examples:[['one of','Seoul is one of the largest cities in Korea.','서울은 한국에서 가장 큰 도시 중 하나이다.']]},
    {title:'시험 함정',note:'최상급 앞에는 보통 the가 필요해요. in은 장소·집단, of는 구체적인 수나 대상 집합과 자주 써요.'}
  ],ex('This is ___ movie I have seen this year.',['① more exciting','② the most exciting','③ most exciting'],'② the most exciting','여러 영화 중 가장 흥미로운 것을 말하므로 the most exciting이 맞아요.'),[['짧은 형용사','the + -est'],['긴 형용사','the most + 형용사'],['불규칙','good → best, bad → worst']]),

  'as-as':g('as ... as 비교','두 대상의 정도가 같음을 나타낼 때 as + 원급 + as를 사용해요. 부정형은 “~만큼 ...하지 않다”라는 뜻이에요.','as + 형용사/부사 원급 + as',[
    {title:'같은 정도',examples:[['형용사','Mina is as tall as Jisu.','미나는 지수만큼 키가 크다.'],['부사','Tom runs as fast as his brother.','Tom은 그의 형만큼 빨리 달린다.']]},
    {title:'부정형',examples:[['not as ... as','This bag is not as heavy as that one.','이 가방은 저 가방만큼 무겁지 않다.']]},
    {title:'수량 표현',examples:[['as many as','She has as many books as I do.','그녀는 나만큼 많은 책을 가지고 있다.'],['as much as','He drinks as much water as I do.','그는 나만큼 많은 물을 마신다.']]},
    {title:'시험 함정',note:'두 as 사이에는 bigger나 more beautiful 같은 비교급이 아니라 반드시 원급이 와요.'}
  ],ex('Your phone is as ___ as mine.',['① expensive','② more expensive','③ most expensive'],'① expensive','as ... as 사이에는 원급 expensive를 사용해요.'),[['기본','as + 원급 + as'],['부정','not as/so + 원급 + as'],['주의','비교급 사용 X']]),

  'comparative-correlative':g('비교급 특수 표현','비교급을 반복해 변화가 계속됨을 나타내거나, 두 변화가 함께 일어남을 나타내는 표현이에요.','비교급 and 비교급 / the 비교급, the 비교급',[
    {title:'점점 더',examples:[['짧은 형용사','It is getting colder and colder.','점점 더 추워지고 있다.'],['긴 형용사','The problem became more and more difficult.','그 문제는 점점 더 어려워졌다.']]},
    {title:'~할수록 더',examples:[['the 비교급','The more you practice, the better you become.','연습할수록 더 잘하게 된다.'],['the 비교급','The earlier you leave, the sooner you arrive.','일찍 떠날수록 더 빨리 도착한다.']]},
    {title:'형태 주의',note:'긴 형용사는 more and more + 형용사로 만들어요. more difficult and more difficult보다 이 형태가 자연스러워요.'},
    {title:'시험 함정',note:'the more ..., the more ... 구조의 the는 정관사라기보다 비교급 구조의 일부로 외워 두는 것이 좋아요.'}
  ],ex('The more carefully you read, the ___ mistakes you make.',['① few','② fewer','③ fewest'],'② fewer','“더 주의 깊게 읽을수록 실수를 더 적게 한다”이므로 the 비교급, the 비교급 구조에서 fewer가 맞아요.'),[['점점','-er and -er / more and more'],['비례 변화','the 비교급, the 비교급'],['핵심','두 변화의 관계']]),

  'simple-present':g('현재시제','반복되는 습관, 일반적인 사실, 변하지 않는 상태를 말할 때 사용해요. 3인칭 단수 주어에서는 동사 형태가 바뀌는 점이 핵심이에요.','주어 + 동사원형 / 3인칭 단수 + 동사-s',[
    {title:'언제 쓰나?',examples:[['습관','I walk to school every day.','나는 매일 걸어서 학교에 간다.'],['사실','The sun rises in the east.','해는 동쪽에서 뜬다.'],['상태','She likes music.','그녀는 음악을 좋아한다.']]},
    {title:'3인칭 단수',table:[['play','plays'],['watch','watches'],['study','studies'],['go','goes'],['have','has']]},
    {title:'부정문과 의문문',examples:[['부정','He does not eat meat.','그는 고기를 먹지 않는다.'],['의문','Does she like science?','그녀는 과학을 좋아하니?']]},
    {title:'시험 함정',note:'does가 나오면 본동사는 원형으로 돌아가요. Does he plays?가 아니라 Does he play?예요.'}
  ],ex('My sister ___ the bus to school every morning.',['① take','② takes','③ taking'],'② takes','My sister는 3인칭 단수이고 every morning은 반복 습관이므로 takes가 맞아요.'),[['신호','every day · usually · often'],['3인칭 단수','동사 + s/es'],['does 뒤','동사원형']]),

  'simple-past':g('과거시제','과거의 특정 시점에 일어나고 끝난 행동이나 상태를 나타내요. 규칙 변화와 불규칙 변화, did 뒤의 동사원형이 핵심이에요.','동사 과거형 / was · were',[
    {title:'규칙 변화',table:[['play','played'],['live','lived'],['study','studied'],['stop','stopped']]},
    {title:'불규칙 변화',table:[['go','went'],['see','saw'],['have','had'],['take','took'],['make','made']]},
    {title:'be동사 과거',examples:[['was','I was tired yesterday.','나는 어제 피곤했다.'],['were','They were at home.','그들은 집에 있었다.']]},
    {title:'부정·의문',examples:[['부정','She did not go out.','그녀는 외출하지 않았다.'],['의문','Did you finish your homework?','숙제를 끝냈니?']]},
    {title:'시험 함정',note:'did/didn’t 뒤에는 과거형이 아니라 동사원형을 써요. Did he went?가 아니라 Did he go?예요.'}
  ],ex('We ___ that museum two years ago.',['① visit','② visited','③ visits'],'② visited','two years ago가 과거 시점을 나타내므로 과거형 visited가 맞아요.'),[['신호','yesterday · ago · last'],['did 뒤','동사원형'],['be동사','was / were']]),

  'past-progressive':g('과거진행형','과거의 특정 시점에 한창 진행 중이던 동작을 나타내요. 짧게 일어난 사건과 배경 동작을 구별하는 문제에 자주 나와요.','was / were + V-ing',[
    {title:'기본 형태',examples:[['단수','She was studying at 9 p.m.','그녀는 오후 9시에 공부하고 있었다.'],['복수','They were playing soccer.','그들은 축구를 하고 있었다.']]},
    {title:'when과 함께',examples:[['배경+사건','I was sleeping when the phone rang.','전화가 울렸을 때 나는 자고 있었다.']]},
    {title:'while과 함께',examples:[['동시 진행','While I was cooking, my brother was setting the table.','내가 요리하는 동안 동생은 식탁을 차리고 있었다.']]},
    {title:'시험 함정',note:'과거진행형은 단순히 “과거였다”가 아니라 그 시점에 진행 중이었다는 의미가 필요해요.'}
  ],ex('At 8 last night, Jina ___ for the test.',['① studied','② was studying','③ is studying'],'② was studying','과거의 특정 시점에 진행 중이던 동작이므로 was studying이 맞아요.'),[['형태','was/were + V-ing'],['배경 동작','과거진행형'],['짧은 사건','과거시제']]),

  'future':g('미래 표현','미래의 예측, 즉석 결정, 계획을 will과 be going to로 나타내요. 두 표현의 형태와 의미 차이를 알아야 해요.','will + V / be going to + V',[
    {title:'will',examples:[['예측','I think it will rain tomorrow.','내일 비가 올 것 같다.'],['즉석 결정','I will help you.','내가 도와줄게.']]},
    {title:'be going to',examples:[['계획','We are going to visit Jeju this weekend.','우리는 이번 주말 제주도를 방문할 예정이다.'],['근거 있는 예측','Look at the clouds. It is going to rain.','구름을 봐. 비가 올 것 같다.']]},
    {title:'부정과 의문',examples:[['will not','He will not come today.','그는 오늘 오지 않을 것이다.'],['Are ... going to','Are you going to join us?','우리와 함께할 예정이니?']]},
    {title:'시험 함정',note:'will 뒤에도, be going to 뒤에도 본동사는 원형이에요. going to 뒤에 -ing를 또 붙이지 않아요.'}
  ],ex('They are going to ___ a new club next month.',['① start','② starts','③ starting'],'① start','be going to 뒤에는 동사원형 start가 와요.'),[['will','will + V'],['계획','be going to + V'],['공통','뒤에 동사원형']]),

  'time-clauses':g('시간 부사절','when, before, after, as soon as, until 같은 시간 접속사가 이끄는 절에서는 미래 의미여도 현재시제를 사용해요.','시간접속사 + 현재시제, 주절 + 미래표현',[
    {title:'대표 접속사',table:[['when','~할 때'],['before','~하기 전에'],['after','~한 후에'],['as soon as','~하자마자'],['until','~할 때까지']]},
    {title:'미래 의미',examples:[['when','When he arrives, I will call you.','그가 도착하면 전화할게.'],['after','We will eat after Dad comes home.','아빠가 집에 오신 후에 먹을 것이다.']]},
    {title:'절의 위치',examples:[['앞','When the class ends, I will text you.','수업이 끝나면 문자할게.'],['뒤','I will text you when the class ends.','수업이 끝나면 문자할게.']]},
    {title:'시험 함정',note:'시간 부사절 안에 will을 쓰지 않는 것이 핵심이에요. 주절에는 will을 쓸 수 있어요.'}
  ],ex('I will wait here until she ___.',['① will come','② comes','③ came'],'② comes','미래 내용이어도 until이 이끄는 시간 부사절에서는 현재시제를 사용해요.'),[['시간절','현재시제'],['주절','will 가능'],['대표','when · before · after · until']]),

  'modals':g('조동사','can, may, must, should, will 같은 조동사는 본동사 앞에서 능력, 의무, 조언, 가능성 등을 더해요. 조동사 뒤에는 항상 동사원형이 와요.','조동사 + 동사원형',[
    {title:'주요 의미',table:[['can','~할 수 있다'],['may','~일지도 모른다 / ~해도 된다'],['must','반드시 ~해야 한다'],['should','~하는 것이 좋다'],['will','~할 것이다']]},
    {title:'부정형',examples:[['cannot','You cannot park here.','여기에 주차할 수 없다.'],['should not','You should not skip breakfast.','아침을 거르면 안 된다.'],['must not','You must not touch this.','이것을 만지면 안 된다.']]},
    {title:'의문문',examples:[['can','Can you swim?','수영할 수 있니?'],['should','Should I call him?','내가 그에게 전화해야 할까?']]},
    {title:'시험 함정',note:'조동사 뒤에는 주어가 3인칭 단수여도 -s를 붙이지 않아요. He can plays가 아니라 He can play예요.'}
  ],ex('You should ___ enough sleep before the exam.',['① get','② gets','③ getting'],'① get','should 뒤에는 동사원형 get이 와요.'),[['형태','조동사 + 동사원형'],['부정','조동사 + not'],['3인칭 단수','-s 붙이지 않음']]),

  'imperatives':g('명령문','명령, 지시, 부탁, 조언을 할 때 주어 you를 생략하고 동사원형으로 시작해요. 부정 명령문은 Don’t + 동사원형이에요.','동사원형 ... / Don’t + V',[
    {title:'긍정 명령문',examples:[['지시','Open your book.','책을 펴세요.'],['부탁','Please sit down.','앉아 주세요.']]},
    {title:'부정 명령문',examples:[['금지','Don’t run in the hall.','복도에서 뛰지 마세요.'],['주의','Don’t forget your umbrella.','우산을 잊지 마세요.']]},
    {title:'be동사 명령문',examples:[['be','Be careful.','조심하세요.'],['negative be','Don’t be late.','늦지 마세요.']]},
    {title:'시험 함정',note:'명령문은 주어가 보이지 않아도 문장 맨 앞에 동사원형이 와요. Be quiet처럼 be도 원형 그대로 씁니다.'}
  ],ex('___ careful when you cross the street.',['① Be','② Are','③ Being'],'① Be','명령문은 동사원형으로 시작하므로 Be가 맞아요.'),[['긍정','동사원형'],['부정','Don’t + 동사원형'],['be동사','Be / Don’t be']]),

  'there-be':g('There is / There are','어떤 장소에 무엇이 존재한다고 말할 때 쓰는 구조예요. 뒤에 오는 명사의 수와 시제에 맞춰 be동사를 바꿔요.','There + be + 명사 + 장소',[
    {title:'현재형',examples:[['단수','There is a cat under the table.','탁자 아래에 고양이 한 마리가 있다.'],['복수','There are three students outside.','밖에 학생 세 명이 있다.']]},
    {title:'과거형',examples:[['단수','There was a problem.','문제가 하나 있었다.'],['복수','There were many people there.','그곳에 많은 사람들이 있었다.']]},
    {title:'의문·부정',examples:[['question','Is there a bank nearby?','근처에 은행이 있나요?'],['negative','There are not any seats left.','남은 좌석이 없다.']]},
    {title:'시험 함정',note:'there는 실제 주어가 아니에요. 뒤에 오는 명사의 수가 be동사 선택의 기준이에요.'}
  ],ex('There ___ two pictures on the wall.',['① is','② are','③ was'],'② are','two pictures가 복수이므로 현재형 are가 맞아요.'),[['단수','There is / was'],['복수','There are / were'],['수일치','뒤 명사를 확인']]),

  'linking-verbs':g('감각·연결동사 + 형용사','look, sound, feel, smell, taste 같은 동사는 주어의 상태를 설명하는 연결동사로 쓰일 수 있어요. 이때 뒤에는 보통 형용사가 와요.','감각동사 + 형용사',[
    {title:'대표 동사',table:[['look','~해 보이다'],['sound','~하게 들리다'],['feel','~하게 느껴지다'],['smell','~한 냄새가 나다'],['taste','~한 맛이 나다'],['become','~하게 되다']]},
    {title:'예문',examples:[['look','You look tired.','너는 피곤해 보인다.'],['sound','That sounds interesting.','그것은 흥미롭게 들린다.'],['taste','The soup tastes salty.','수프가 짠맛이 난다.']]},
    {title:'부사와 구별',examples:[['연결동사','She looks happy.','그녀는 행복해 보인다.'],['일반동사','She looked carefully at the map.','그녀는 지도를 주의 깊게 보았다.']]},
    {title:'시험 함정',note:'같은 look이라도 “~해 보이다”면 형용사, “보다”라는 행동이면 부사가 올 수 있어요.'}
  ],ex('The music sounds ___.',['① beautiful','② beautifully','③ beauty'],'① beautiful','sound가 연결동사로 쓰여 음악의 상태를 설명하므로 형용사 beautiful이 맞아요.'),[['연결동사 뒤','형용사'],['대표','look · sound · feel · smell · taste'],['구별','일반동사면 부사 가능']]),

  'perception-verbs':g('지각동사','see, hear, watch, feel 같은 지각동사는 목적어 뒤에 동사원형 또는 V-ing를 취할 수 있어요. 전체 동작인지 진행 장면인지에 따라 의미가 달라져요.','지각동사 + 목적어 + V / V-ing',[
    {title:'동사원형',examples:[['전체 동작','I saw him cross the street.','나는 그가 길을 건너는 전 과정을 보았다.']]},
    {title:'V-ing',examples:[['진행 장면','I saw him crossing the street.','나는 그가 길을 건너고 있는 것을 보았다.']]},
    {title:'대표 동사',table:[['see','보다'],['hear','듣다'],['watch','지켜보다'],['feel','느끼다']]},
    {title:'시험 함정',note:'지각동사 뒤 목적격 보어로 to부정사를 쓰지 않는 것이 기본이에요. see him to run이 아니라 see him run/running이에요.'}
  ],ex('We watched the children ___ in the park.',['① play','② to play','③ played'],'① play','지각동사 watch + 목적어 + 동사원형 구조가 가능하므로 play가 맞아요.'),[['전체 동작','목적어 + V'],['진행 장면','목적어 + V-ing'],['주의','to V 사용 X']]),

  'that-clauses':g('that절','that + 주어 + 동사는 문장 안에서 하나의 명사 덩어리처럼 쓰여 동사의 목적어가 되는 경우가 많아요. that은 자주 생략할 수 있어요.','동사 + (that) + 주어 + 동사',[
    {title:'목적어 역할',examples:[['think','I think that she is right.','나는 그녀가 옳다고 생각한다.'],['know','We know that he is honest.','우리는 그가 정직하다는 것을 안다.']]},
    {title:'that 생략',examples:[['생략 가능','I think she is right.','나는 그녀가 옳다고 생각한다.']]},
    {title:'자주 쓰는 동사',table:[['think','생각하다'],['know','알다'],['believe','믿다'],['hope','바라다'],['say','말하다']]},
    {title:'시험 함정',note:'지시대명사 that(저것)과 접속사 that을 구별하세요. 접속사 that 뒤에는 완전한 문장(주어+동사)이 와요.'}
  ],ex('I believe ___ our team can win.',['① that','② what','③ to'],'① that','뒤에 our team can win이라는 완전한 절이 오므로 접속사 that이 자연스러워요.'),[['형태','that + S + V'],['역할','명사절'],['생략','목적어 that은 자주 생략 가능']]),

  'passive':g('수동태','행동을 하는 사람보다 행동을 받는 대상이 중요할 때 수동태를 사용해요. be동사의 시제와 과거분사 형태를 함께 확인해야 해요.','be + 과거분사(p.p.)',[
    {title:'능동 → 수동',table:[['People speak English here.','English is spoken here.'],['They built the bridge in 2010.','The bridge was built in 2010.']]},
    {title:'시제',table:[['현재','am/is/are + p.p.'],['과거','was/were + p.p.'],['미래','will be + p.p.']]},
    {title:'행위자',examples:[['by','The picture was painted by Mina.','그 그림은 미나에 의해 그려졌다.']]},
    {title:'시험 함정',note:'수동태는 be동사만 있거나 과거분사만 있어서는 안 돼요. 두 요소가 함께 필요해요.'}
  ],ex('The windows ___ every Friday.',['① clean','② are cleaned','③ cleaned'],'② are cleaned','창문은 청소를 받는 대상이고 반복되는 현재 사실이므로 are cleaned가 맞아요.'),[['형태','be + p.p.'],['현재','is/are + p.p.'],['과거','was/were + p.p.']]),

  'agreement':g('주어-동사 수일치','현재시제에서 주어가 단수인지 복수인지에 따라 동사 형태가 달라져요. 긴 주어에서는 핵심 주어를 찾는 것이 중요해요.','단수 주어 → 단수 동사 / 복수 주어 → 복수 동사',[
    {title:'기본',examples:[['단수','The student likes math.','그 학생은 수학을 좋아한다.'],['복수','The students like math.','그 학생들은 수학을 좋아한다.']]},
    {title:'each / every',examples:[['each','Each student has a locker.','각 학생은 사물함이 하나씩 있다.'],['every','Every book is useful.','모든 책이 유용하다.']]},
    {title:'긴 주어',examples:[['핵심 주어','The color of these bags is beautiful.','이 가방들의 색은 아름답다.']]},
    {title:'시험 함정',note:'of 뒤 명사에 끌리지 마세요. The color of these bags의 진짜 주어는 color이므로 is를 써요.'}
  ],ex('Each of the players ___ a number.',['① have','② has','③ having'],'② has','Each가 핵심 주어이므로 단수 동사 has가 맞아요.'),[['핵심','진짜 주어 찾기'],['each/every','단수 취급'],['복수 주어','동사원형']]),

  'reflexive':g('재귀대명사','주어와 목적어가 같은 사람이나 사물일 때 -self/-selves 형태를 사용해요. 강조 용법과 by oneself 표현도 자주 나와요.','myself · yourself · himself · herself · itself · ourselves · yourselves · themselves',[
    {title:'형태',table:[['I','myself'],['you','yourself / yourselves'],['he','himself'],['she','herself'],['it','itself'],['we','ourselves'],['they','themselves']]},
    {title:'재귀 용법',examples:[['목적어','She introduced herself.','그녀는 자기 자신을 소개했다.']]},
    {title:'강조 용법',examples:[['강조','I made this cake myself.','내가 직접 이 케이크를 만들었다.']]},
    {title:'by oneself',examples:[['혼자','He traveled by himself.','그는 혼자 여행했다.']]},
    {title:'시험 함정',note:'주어와 목적어가 같은지 확인하세요. Mina saw her는 다른 여자를 볼 수 있지만 Mina saw herself는 자기 자신을 본 뜻이에요.'}
  ],ex('The boy made the robot by ___.',['① him','② himself','③ his'],'② himself','by oneself는 “혼자서”라는 뜻이므로 himself가 맞아요.'),[['같은 대상','재귀대명사'],['강조','직접'],['by oneself','혼자서']]),

  'each-every':g('each / every / all','모두를 가리키는 표현이지만 뒤 명사의 형태와 동사의 수일치가 달라요.','each/every + 단수명사 / all + 복수명사·불가산명사',[
    {title:'each',examples:[['each','Each student has a book.','각 학생은 책을 한 권씩 가지고 있다.']]},
    {title:'every',examples:[['every','Every room is clean.','모든 방이 깨끗하다.']]},
    {title:'all',examples:[['복수','All students are ready.','모든 학생들이 준비되었다.'],['불가산','All water is clean.','모든 물이 깨끗하다.']]},
    {title:'시험 함정',note:'each/every 뒤에는 단수명사가 오고 동사도 단수형을 써요. every students는 틀린 형태예요.'}
  ],ex('Every student ___ a locker.',['① have','② has','③ having'],'② has','Every + 단수명사는 단수 취급하므로 has가 맞아요.'),[['each/every','단수명사 + 단수동사'],['all','복수/불가산 가능'],['주의','every students X']]),

  'pronouns':g('대명사','명사의 반복을 피하기 위해 인칭대명사, 목적격, 소유격, one 등을 사용해요. 문장 속 자리와 역할을 보고 형태를 골라야 해요.','주격 / 목적격 / 소유격 / 소유대명사',[
    {title:'인칭대명사',table:[['I','me'],['he','him'],['she','her'],['we','us'],['they','them']]},
    {title:'소유 표현',table:[['my','mine'],['your','yours'],['his','his'],['her','hers'],['our','ours'],['their','theirs']]},
    {title:'one',examples:[['one','I need a pen. Do you have one?','나는 펜이 필요하다. 하나 있니?']]},
    {title:'시험 함정',note:'동사 앞 주어 자리에는 주격, 동사·전치사 뒤 목적어 자리에는 목적격을 사용해요.'}
  ],ex('Jina helped ___ with my homework.',['① I','② me','③ my'],'② me','helped 뒤 목적어 자리이므로 목적격 me가 맞아요.'),[['주어 자리','주격'],['목적어 자리','목적격'],['명사 반복','one 사용 가능']]),

  'adjective-adverb':g('형용사와 부사','형용사는 명사를 꾸미거나 보어로 쓰이고, 부사는 동사·형용사·다른 부사를 꾸며요. 형태가 비슷해도 역할이 달라요.','형용사 → 명사/보어 / 부사 → 동사·형용사·부사',[
    {title:'형용사',examples:[['명사 수식','She is a careful driver.','그녀는 주의 깊은 운전자다.'],['보어','She looks careful.','그녀는 주의 깊어 보인다.']]},
    {title:'부사',examples:[['동사 수식','She drives carefully.','그녀는 주의 깊게 운전한다.']]},
    {title:'형태',table:[['quick','quickly'],['careful','carefully'],['easy','easily'],['good','well']]},
    {title:'시험 함정',note:'감각·연결동사 look, feel, sound 뒤에는 보통 형용사가 와요. good/well처럼 불규칙도 주의하세요.'}
  ],ex('He answered the question ___.',['① correct','② correctly','③ correctness'],'② correctly','answered라는 동사를 꾸미므로 부사 correctly가 맞아요.'),[['형용사','명사/보어 수식'],['부사','동사 수식'],['불규칙','good → well']]),

  'prepositions':g('전치사','전치사는 명사나 대명사 앞에서 시간, 장소, 방향, 방법 등의 관계를 나타내요. 표현별로 자주 쓰는 전치사를 묶어서 익히는 것이 중요해요.','전치사 + 명사/대명사/V-ing',[
    {title:'시간',table:[['at','정확한 시각'],['on','요일·날짜'],['in','월·계절·연도']]},
    {title:'장소',table:[['at','지점'],['on','표면'],['in','공간 안']]},
    {title:'방법',examples:[['by','I go to school by bus.','나는 버스로 학교에 간다.'],['on foot','She goes there on foot.','그녀는 걸어서 간다.']]},
    {title:'뒤 형태',examples:[['V-ing','He is good at drawing.','그는 그림을 잘 그린다.']]},
    {title:'시험 함정',note:'전치사 뒤에 동사가 필요하면 보통 V-ing 형태가 와요. at draw가 아니라 at drawing이에요.'}
  ],ex('We have a meeting ___ Monday.',['① at','② on','③ in'],'② on','요일 앞에는 전치사 on을 사용해요.'),[['시간','at / on / in'],['방법','by + 교통수단'],['전치사 뒤 동사','V-ing']]),

  'conjunctions':g('접속사','접속사는 단어, 구, 절을 연결해 의미 관계를 보여 줘요. and, but, because, although 같은 접속사의 의미 차이가 시험에 자주 나와요.','절 + 접속사 + 절',[
    {title:'등위접속사',table:[['and','그리고'],['but','하지만'],['or','또는'],['so','그래서']]},
    {title:'종속접속사',table:[['because','~이기 때문에'],['although','비록 ~이지만'],['if','만약 ~라면'],['when','~할 때']]},
    {title:'although와 but',examples:[['although','Although it was raining, we went out.','비가 왔지만 우리는 나갔다.']]},
    {title:'시험 함정',note:'한 문장에서 Although ..., but ...처럼 둘을 동시에 쓰지 않는 것이 기본이에요.'}
  ],ex('___ he was tired, he finished the work.',['① Although','② But','③ So'],'① Although','뒤에 완전한 절이 이어지고 “피곤했지만”이라는 양보 의미가 필요하므로 Although가 맞아요.'),[['대조','but / although'],['이유','because'],['주의','although + but 중복 X']]),

  'indirect-questions':g('간접의문문','의문문을 다른 문장 안에 넣을 때 의문사 뒤 어순이 평서문 어순으로 바뀌어요.','의문사 + 주어 + 동사',[
    {title:'직접의문문 → 간접의문문',table:[['Where is he?','Do you know where he is?'],['What does she want?','Do you know what she wants?']]},
    {title:'yes/no 의문문',examples:[['if/whether','I wonder if he is busy.','나는 그가 바쁜지 궁금하다.']]},
    {title:'do/does/did 제거',note:'간접의문문에서는 do/does/did가 사라지고 본동사가 시제와 주어에 맞게 바뀌어요.'},
    {title:'시험 함정',note:'where is he가 아니라 where he is예요. 물음표가 있어도 간접의문절 내부는 평서문 어순입니다.'}
  ],ex('Do you know where ___.',['① is she','② she is','③ does she'],'② she is','간접의문문에서는 의문사 뒤에 주어 + 동사 어순을 사용해요.'),[['어순','의문사 + S + V'],['yes/no','if / whether'],['주의','도치 X']]),

  'countability':g('셀 수 있는·없는 명사','명사가 셀 수 있는지에 따라 관사, 복수형, 수량 표현이 달라져요. advice, information 같은 대표 불가산명사를 특히 주의해야 해요.','countable / uncountable',[
    {title:'가산명사',examples:[['단수','a book','책 한 권'],['복수','three books','책 세 권']]},
    {title:'불가산명사',table:[['water','물'],['information','정보'],['advice','조언'],['furniture','가구'],['homework','숙제']]},
    {title:'수량 표현',table:[['many','가산 복수'],['much','불가산'],['a few','가산 복수'],['a little','불가산'],['some','둘 다 가능']]},
    {title:'시험 함정',note:'an advice, informations처럼 쓰지 않아요. a piece of advice처럼 단위를 붙여 셀 수 있어요.'}
  ],ex('She gave me some useful ___.',['① advices','② advice','③ an advice'],'② advice','advice는 불가산명사라 복수형 -s나 a/an을 붙이지 않아요.'),[['가산','a/an, 복수 -s'],['불가산','a/an X, -s X'],['대표','advice · information · homework']]),

  'sentence-patterns':g('문장 형식과 어순','영어 문장은 동사 뒤에 어떤 성분이 필요한지에 따라 기본 구조가 달라져요. 주어·동사·목적어·보어의 위치를 파악하면 어순 문제를 쉽게 풀 수 있어요.','S + V / S + V + O / S + V + C / S + V + IO + DO',[
    {title:'주요 문장 형식',table:[['1형식','S + V'],['2형식','S + V + C'],['3형식','S + V + O'],['4형식','S + V + 사람 + 사물'],['5형식','S + V + O + C']]},
    {title:'예문',examples:[['2형식','She looks happy.','그녀는 행복해 보인다.'],['3형식','I like music.','나는 음악을 좋아한다.'],['4형식','He gave me a gift.','그는 나에게 선물을 주었다.']]},
    {title:'어순',note:'영어는 조사보다 어순이 역할을 결정하는 경우가 많아요. 목적어와 보어의 위치를 함부로 바꾸면 뜻이 달라져요.'},
    {title:'시험 함정',note:'동사마다 요구하는 문장 구조가 달라요. give는 사람+사물, look은 형용사 보어가 자주 뒤따릅니다.'}
  ],ex('Choose the correct order: gave / me / my teacher / a book',['① My teacher gave me a book.','② My teacher me gave a book.','③ My teacher gave a book me.'],'① My teacher gave me a book.','give의 4형식은 주어 + give + 사람 + 사물 순서예요.'),[['3형식','S + V + O'],['4형식','S + V + 사람 + 사물'],['핵심','동사가 요구하는 자리']]),

  'parallel-structure':g('병렬구조','and, or, but 등으로 같은 역할의 표현을 연결할 때 문법 형태를 맞추는 것이 병렬구조예요.','A and B → A와 B의 형태를 맞춤',[
    {title:'동사 형태 맞추기',examples:[['동명사','I like reading and writing.','나는 읽기와 쓰기를 좋아한다.'],['to부정사','She wants to travel and to meet new people.','그녀는 여행하고 새로운 사람들을 만나고 싶어 한다.']]},
    {title:'형용사·명사 병렬',examples:[['형용사','He is kind and honest.','그는 친절하고 정직하다.'],['명사','We need time and patience.','우리는 시간과 인내가 필요하다.']]},
    {title:'시험 함정',note:'reading and to write처럼 같은 자리에서 형태를 섞지 않는 것이 기본이에요.'}
  ],ex('She enjoys ___ and dancing.',['① sing','② singing','③ to sing'],'② singing','and로 연결된 dancing과 같은 형태의 singing이 필요해요.'),[['원칙','같은 역할 = 같은 형태'],['연결어','and · or · but'],['주의','V-ing와 to V 혼용 주의']]),

  'sentence-transformation':g('문장 전환','두 문장이 같은 뜻을 유지하도록 문법 구조를 바꾸는 문제예요. 4형식↔3형식, 비교 표현, 능동↔수동 등 다양한 문법을 통합해서 확인해요.','의미는 유지하고 구조만 바꾸기',[
    {title:'4형식 ↔ 3형식',table:[['She gave me a book.','She gave a book to me.'],['Dad bought me a bike.','Dad bought a bike for me.']]},
    {title:'비교 표현',table:[['Tom is taller than Jim.','Jim is not as tall as Tom.']]},
    {title:'능동 ↔ 수동',table:[['People use this app widely.','This app is widely used.']]},
    {title:'시험 함정',note:'단어만 바꾸는 것이 아니라 시제, 수일치, 전치사까지 모두 유지해야 같은 뜻이 돼요.'}
  ],ex('Choose the sentence with the same meaning: Mina gave me a present.',['① Mina gave a present to me.','② Mina gave a present for me.','③ Mina gave me to a present.'],'① Mina gave a present to me.','give는 4형식을 3형식으로 바꿀 때 to를 사용해요.'),[['핵심','뜻 유지'],['확인','시제 · 수일치 · 전치사'],['빈출','4↔3형식 · 비교 · 수동태']]),

  'conditionals':g('조건문','if절은 어떤 조건이 충족될 때 일어나는 결과를 나타내요. 실제 가능성이 있는 미래 조건에서는 if절에 현재시제를 사용해요.','If + 현재시제, 주절 + will/can + V',[
    {title:'실현 가능한 조건',examples:[['future','If it rains, we will stay home.','비가 오면 우리는 집에 있을 것이다.'],['can','If you finish early, you can go home.','일찍 끝내면 집에 가도 된다.']]},
    {title:'절의 위치',examples:[['앞','If you are tired, take a break.','피곤하면 쉬어라.'],['뒤','Take a break if you are tired.','피곤하면 쉬어라.']]},
    {title:'미래 표현 주의',note:'미래를 말해도 if절 안에는 보통 will을 쓰지 않고 현재시제를 써요.'},
    {title:'시험 함정',note:'If it will rain처럼 쓰지 않는 것이 중학교 기본 규칙이에요. 주절에는 will을 사용할 수 있어요.'}
  ],ex('If she ___ hard, she will pass the test.',['① will study','② studies','③ studied'],'② studies','실현 가능한 미래 조건에서 if절은 현재시제를 사용해요.'),[['if절','현재시제'],['주절','will/can + V 가능'],['주의','if절의 will X']]),

  'be-present':g('현재형 be동사','be동사는 주어의 상태, 신분, 위치를 나타내며 주어에 따라 am, is, are로 바뀌어요. 일반동사와 달리 의문문과 부정문을 스스로 만들 수 있어요.','I am / he·she·it is / you·we·they are',[
    {title:'주어에 따른 형태',table:[['I','am'],['he/she/it','is'],['you/we/they','are']]},
    {title:'부정문',examples:[['am not','I am not tired.','나는 피곤하지 않다.'],['is not','She is not at home.','그녀는 집에 있지 않다.']]},
    {title:'의문문',examples:[['Are','Are you ready?','준비됐니?'],['Is','Is he your brother?','그가 네 형이니?']]},
    {title:'시험 함정',note:'be동사 문장에는 do/does를 쓰지 않아요. Does she happy?가 아니라 Is she happy?예요.'}
  ],ex('My parents ___ at work now.',['① is','② are','③ am'],'② are','My parents는 복수 주어이므로 are를 사용해요.'),[['I','am'],['단수','is'],['복수/you','are']]),

  'questions':g('의문문','영어 의문문은 문장 종류에 따라 be동사, 조동사, do/does/did를 문장 앞에 놓아 만들어요. 대답하려는 정보에 따라 의문사를 사용할 수 있어요.','Be/조동사/Do + 주어 + ... ?',[
    {title:'be동사 의문문',examples:[['be','Is she a student?','그녀는 학생이니?']]},
    {title:'일반동사 의문문',examples:[['do','Do you like soccer?','축구를 좋아하니?'],['does','Does he play tennis?','그는 테니스를 치니?']]},
    {title:'의문사',table:[['who','누구'],['what','무엇'],['where','어디'],['when','언제'],['why','왜'],['how','어떻게']]},
    {title:'시험 함정',note:'does/did가 나오면 본동사는 원형이에요. Does he likes?가 아니라 Does he like?예요.'}
  ],ex('___ your sister like music?',['① Is','② Does','③ Do'],'② Does','like는 일반동사이고 your sister는 3인칭 단수이므로 Does를 사용해요.'),[['be동사','Be + S ...?'],['일반동사','Do/Does/Did + S + V ...?'],['does/did 뒤','동사원형']])
});
