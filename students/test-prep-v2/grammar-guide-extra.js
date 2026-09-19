import {GUIDES} from './grammar-guide.js?v=2.1.2';

const g=(title,summary,formula,sections,exam,memory)=>({title,summary,formula,sections,exam,memory});
const ex=(prompt,choices,answer,explanation)=>({prompt,choices,answer,explanation});

Object.assign(GUIDES,{
  'to-infinitive-purpose':g('목적을 나타내는 to부정사','왜 어떤 행동을 하는지 목적을 말할 때 to + 동사원형을 써요.','to + V = ~하기 위해',[
    {title:'목적 표현',examples:[['to help','I went there to help my friend.','나는 친구를 돕기 위해 그곳에 갔다.'],['to buy','She saved money to buy a bike.','그녀는 자전거를 사기 위해 돈을 모았다.']]},
    {title:'구별',note:'want to처럼 앞 동사의 목적어가 되는 to부정사와, 문장 전체의 목적을 설명하는 to부정사를 구별해요.'}
  ],ex('He got up early ___ the first bus.',['① catch','② to catch','③ catching'],'② to catch','일찍 일어난 목적을 나타내므로 to catch가 맞아요.'),[['의미','~하기 위해'],['형태','to + 동사원형']]),

  'dummy-it':g('가주어 it','긴 to부정사 주어를 뒤로 보내고 앞에 it을 두는 표현이에요.','It + be + 형용사 + to V',[
    {title:'기본 구조',examples:[['easy','It is easy to use this app.','이 앱을 사용하는 것은 쉽다.'],['important','It is important to get enough sleep.','충분히 자는 것은 중요하다.']]},
    {title:'진짜 주어',note:'문장 앞의 it은 특별한 뜻이 없고, 뒤의 to부정사가 실제 내용이에요.'}
  ],ex('___ is important to follow the rules.',['① It','② This','③ There'],'① It','It is + 형용사 + to V 구조예요.'),[['형태','It is + adj + to V'],['핵심','진짜 내용은 뒤의 to V']]),

  'superlatives':g('최상급','셋 이상을 비교해서 가장 ~한 것을 말할 때 최상급을 사용해요.','the + 최상급 + 범위',[
    {title:'기본 변화',table:[['tall','the tallest'],['busy','the busiest'],['beautiful','the most beautiful'],['good','the best']]},
    {title:'범위 표현',examples:[['in','Jin is the tallest in the class.','진은 반에서 가장 키가 크다.'],['of','This is the best of the three.','이것이 셋 중 가장 좋다.']]}
  ],ex('Mt. Everest is ___ mountain in the world.',['① higher','② the highest','③ the higher'],'② the highest','in the world처럼 범위 안에서 가장 높은 것을 말하므로 최상급을 써요.'),[['형태','the + -est / most'],['불규칙','good → best']]),

  'as-as':g('as ... as 비교','두 대상의 정도가 같거나 다름을 나타내요.','as + 원급 + as',[
    {title:'같은 정도',examples:[['as tall as','Mina is as tall as Jisu.','미나는 지수만큼 키가 크다.']]},
    {title:'같지 않음',examples:[['not as ... as','This bag is not as heavy as that one.','이 가방은 저 가방만큼 무겁지 않다.']]},
    {title:'주의',note:'as와 as 사이에는 비교급이 아니라 원급을 써요.'}
  ],ex('My room is as ___ as yours.',['① big','② bigger','③ biggest'],'① big','as ... as 사이에는 형용사의 원급이 와요.'),[['긍정','as + 원급 + as'],['부정','not as + 원급 + as']]),

  'comparative-correlative':g('비교급 특수 표현','비교급을 반복하거나 두 변화를 연결하는 시험 빈출 표현이에요.','비교급 and 비교급 / the 비교급, the 비교급',[
    {title:'점점 더',examples:[['bigger and bigger','The city is getting bigger and bigger.','도시는 점점 더 커지고 있다.']]},
    {title:'~할수록 더',examples:[['the more, the better','The more you practice, the better you become.','연습할수록 더 좋아진다.']]}
  ],ex('The ___ you read, the more you learn.',['① much','② more','③ most'],'② more','the 비교급, the 비교급 구조예요.'),[['점점','비교급 and 비교급'],['~할수록','the 비교급, the 비교급']]),

  'simple-present':g('현재시제','반복되는 습관, 사실, 일반적인 상태를 말할 때 현재시제를 써요.','주어 + 동사원형 / 3인칭 단수 -s',[
    {title:'3인칭 단수',table:[['play','plays'],['study','studies'],['go','goes'],['have','has']]},
    {title:'의문문과 부정문',examples:[['question','Does she like music?','그녀는 음악을 좋아하니?'],['negative','He does not eat meat.','그는 고기를 먹지 않는다.']]},
    {title:'주의',note:'does가 나오면 뒤 동사는 원형이에요: Does he play? / He does not play.'}
  ],ex('My brother ___ soccer every Sunday.',['① play','② plays','③ playing'],'② plays','My brother는 3인칭 단수이고 반복 습관이므로 plays가 맞아요.'),[['습관','usually · every day'],['3인칭 단수','동사 + s/es']]),

  'simple-past':g('과거시제','과거에 끝난 행동이나 상태를 말할 때 써요.','동사 과거형 / was · were',[
    {title:'규칙·불규칙',table:[['play','played'],['study','studied'],['go','went'],['see','saw']]},
    {title:'부정·의문',examples:[['negative','I did not go there.','나는 거기에 가지 않았다.'],['question','Did you see him?','너는 그를 봤니?']]},
    {title:'주의',note:'did 뒤에는 과거형이 아니라 동사원형을 써요.'}
  ],ex('Did Mina ___ the movie yesterday?',['① watched','② watch','③ watching'],'② watch','Did 뒤에는 동사원형이 와요.'),[['신호','yesterday · ago · last'],['did 뒤','동사원형']]),

  'past-progressive':g('과거진행형','과거의 특정 시점에 진행 중이던 동작을 나타내요.','was / were + V-ing',[
    {title:'기본 형태',examples:[['was','I was studying at 8 p.m.','나는 오후 8시에 공부하고 있었다.'],['were','They were playing outside.','그들은 밖에서 놀고 있었다.']]},
    {title:'함께 나오는 표현',note:'when, while과 함께 과거의 진행 중인 상황을 묻는 문제가 자주 나와요.'}
  ],ex('At 9 last night, we ___ TV.',['① watched','② were watching','③ are watching'],'② were watching','과거 특정 시점에 진행 중이던 동작이므로 were watching이에요.'),[['형태','was/were + V-ing'],['시점','at 8 yesterday']]),

  'future':g('미래 표현','앞으로의 계획이나 예측을 will 또는 be going to로 나타내요.','will + V / be going to + V',[
    {title:'will',examples:[['prediction','It will rain tomorrow.','내일 비가 올 것이다.']]},
    {title:'be going to',examples:[['plan','I am going to visit Busan.','나는 부산을 방문할 예정이다.']]},
    {title:'주의',note:'will 뒤와 be going to 뒤에는 모두 동사원형이 와요.'}
  ],ex('She is going to ___ her grandmother tomorrow.',['① visits','② visit','③ visiting'],'② visit','be going to 뒤에는 동사원형을 써요.'),[['will','will + V'],['계획','be going to + V']]),

  'time-clauses':g('시간 부사절','미래 이야기라도 when, before, after 같은 시간 접속사 뒤에서는 현재시제를 써요.','when + 현재, 주절 + will',[
    {title:'미래의 시간절',examples:[['when','When he comes, I will tell him.','그가 오면 나는 그에게 말할 것이다.'],['before','I will call you before I leave.','떠나기 전에 전화할게.']]},
    {title:'시험 함정',note:'when절 안에 will을 넣지 않는 것이 핵심이에요.'}
  ],ex('I will text you when I ___ home.',['① will get','② get','③ got'],'② get','미래를 뜻해도 when절에서는 현재시제를 써요.'),[['시간절','when/before/after + 현재'],['주절','will + 동사원형']]),

  'modals':g('조동사','can, should, will, must 같은 조동사 뒤에는 동사원형이 와요.','조동사 + 동사원형',[
    {title:'기본',table:[['can','~할 수 있다'],['should','~해야 한다'],['will','~할 것이다'],['have to','~해야 한다']]},
    {title:'부정',examples:[['should not','You should not stay up late.','너는 늦게까지 깨어 있으면 안 된다.']]},
    {title:'주의',note:'can plays, should goes처럼 조동사 뒤에 -s를 붙이지 않아요.'}
  ],ex('You should ___ more water.',['① drink','② drinks','③ drinking'],'① drink','should 뒤에는 동사원형이 와요.'),[['조동사 뒤','항상 동사원형'],['부정','should not / cannot']]),

  'imperatives':g('명령문','상대에게 행동을 하거나 하지 말라고 말할 때 동사원형으로 시작해요.','동사원형 ... / Don’t + V',[
    {title:'긍정 명령문',examples:[['open','Open the window.','창문을 여세요.']]},
    {title:'부정 명령문',examples:[['don’t','Don’t run here.','여기서 뛰지 마세요.']]}
  ],ex('___ quiet in the library.',['① Be','② Is','③ Being'],'① Be','명령문은 동사원형으로 시작해요.'),[['긍정','동사원형으로 시작'],['부정','Don’t + 동사원형']]),

  'there-be':g('There is / There are','어떤 것이 존재한다고 말할 때 사용하는 구조예요.','There is + 단수 / There are + 복수',[
    {title:'수 일치',examples:[['singular','There is a book on the desk.','책상 위에 책 한 권이 있다.'],['plural','There are two books on the desk.','책상 위에 책 두 권이 있다.']]},
    {title:'주의',note:'뒤에 나오는 명사의 수에 맞춰 is/are를 골라요.'}
  ],ex('There ___ three apples in the basket.',['① is','② are','③ be'],'② are','three apples가 복수이므로 are를 써요.'),[['단수','There is'],['복수','There are']]),

  'linking-verbs':g('감각·연결동사 + 형용사','look, sound, feel, smell, taste 뒤에서는 주어의 상태를 설명하는 형용사가 와요.','look / sound / feel / smell / taste + 형용사',[
    {title:'형용사가 오는 이유',examples:[['look','You look tired.','너는 피곤해 보인다.'],['sound','That sounds great.','그거 좋게 들린다.'],['smell','The soup smells good.','그 수프는 좋은 냄새가 난다.']]},
    {title:'시험 함정',note:'You look happily가 아니라 You look happy처럼 형용사를 써요.'}
  ],ex('The cookies smell ___.',['① delicious','② deliciously','③ deliciousness'],'① delicious','smell은 연결동사라 뒤에 형용사 delicious가 와요.'),[['연결동사','look/sound/feel/smell/taste'],['뒤 형태','형용사']]),

  'perception-verbs':g('지각동사','see, hear, watch 같은 지각동사는 목적어 뒤에 동사원형이나 -ing 형태가 올 수 있어요.','see/hear/watch + 목적어 + V / V-ing',[
    {title:'진행 장면',examples:[['V-ing','I saw him running.','나는 그가 달리고 있는 것을 보았다.']]},
    {title:'전체 동작',examples:[['동사원형','I watched her cross the street.','나는 그녀가 길을 건너는 것을 지켜보았다.']]}
  ],ex('I heard someone ___ my name.',['① called','② calling','③ to call'],'② calling','진행 중인 소리를 들은 상황에서는 목적어 + V-ing가 자연스러워요.'),[['형태','목적어 + V / V-ing'],['대표 동사','see · hear · watch']]),

  'that-clauses':g('that절','that 뒤에 완전한 문장을 붙여 생각·사실·말의 내용을 나타내요.','동사 + (that) + 주어 + 동사',[
    {title:'목적어 that절',examples:[['think','I think that she is right.','나는 그녀가 맞다고 생각한다.'],['know','We know that he is honest.','우리는 그가 정직하다는 것을 안다.']]},
    {title:'that 생략',note:'목적어 역할의 that은 자주 생략할 수 있어요: I think she is right.'}
  ],ex('I believe ___ he can do it.',['① that','② what','③ to'],'① that','뒤에 완전한 문장 he can do it이 오므로 that절이 맞아요.'),[['that 뒤','완전한 문장'],['목적어절','that 생략 가능']]),

  'passive':g('수동태','행동을 하는 사람보다 행동을 받는 대상을 중심으로 말할 때 써요.','be + 과거분사(p.p.)',[
    {title:'현재 수동',examples:[['is made','This table is made of wood.','이 탁자는 나무로 만들어진다.']]},
    {title:'과거 수동',examples:[['was built','The bridge was built in 2010.','그 다리는 2010년에 지어졌다.']]},
    {title:'주의',note:'시제는 be동사에서 나타내고, 뒤에는 과거분사를 써요.'}
  ],ex('English ___ in many countries.',['① speaks','② is spoken','③ spoke'],'② is spoken','English가 말하는 것이 아니라 사용되는 대상이므로 수동태예요.'),[['형태','be + p.p.'],['시제','be동사가 바뀜']]),

  'agreement':g('주어-동사 수일치','주어가 단수인지 복수인지에 따라 동사의 형태를 맞춰요.','단수 주어 → 단수 동사 / 복수 주어 → 복수 동사',[
    {title:'기본',examples:[['singular','The boy plays soccer.','그 소년은 축구를 한다.'],['plural','The boys play soccer.','그 소년들은 축구를 한다.']]},
    {title:'특별한 주어',note:'Each, every, everyone은 뜻상 여러 사람을 가리켜도 문법적으로 단수 취급해요.'}
  ],ex('Everyone ___ a ticket.',['① have','② has','③ having'],'② has','everyone은 단수 취급하므로 has가 맞아요.'),[['단수','동사 -s / is / has'],['복수','동사원형 / are / have']]),

  'reflexive':g('재귀대명사','주어와 목적어가 같은 사람일 때 myself, yourself 같은 재귀대명사를 써요.','myself / yourself / himself / herself / ourselves / themselves',[
    {title:'목적어',examples:[['herself','She hurt herself.','그녀는 자신을 다치게 했다.']]},
    {title:'강조',examples:[['myself','I made it myself.','내가 직접 그것을 만들었다.']]},
    {title:'by oneself',examples:[['alone','He traveled by himself.','그는 혼자 여행했다.']]}
  ],ex('Tom made the model by ___.',['① him','② himself','③ his'],'② himself','by oneself는 혼자서라는 뜻이에요.'),[['같은 사람','주어 = 목적어'],['혼자','by + 재귀대명사']]),

  'each-every':g('each / every / all','각각, 모든이라는 뜻의 한정사가 어떤 명사와 동사를 요구하는지 구별해요.','each/every + 단수명사 / all + 복수명사',[
    {title:'each / every',examples:[['each','Each student has a book.','각 학생은 책을 가지고 있다.'],['every','Every room is clean.','모든 방이 깨끗하다.']]},
    {title:'all',examples:[['all','All students are ready.','모든 학생들이 준비되었다.']]}
  ],ex('Every student ___ a locker.',['① have','② has','③ are having'],'② has','every + 단수명사는 단수 동사와 함께 써요.'),[['each/every','단수명사 + 단수동사'],['all','복수명사 + 복수동사']]),

  'pronouns':g('대명사','명사를 반복하지 않도록 I/me, he/him, it/one 같은 대명사를 사용해요.','주격 / 목적격 / 소유격 / 대명사',[
    {title:'주격과 목적격',table:[['I','me'],['he','him'],['she','her'],['we','us'],['they','them']]},
    {title:'it / one',note:'it은 앞에서 말한 바로 그 대상을, one은 같은 종류의 다른 하나를 가리킬 수 있어요.'}
  ],ex('I met Jina and talked to ___.',['① she','② her','③ hers'],'② her','전치사 to 뒤의 목적어 자리이므로 목적격 her가 와요.'),[['주어 자리','I/he/she/we/they'],['목적어 자리','me/him/her/us/them']]),

  'adjective-adverb':g('형용사와 부사','형용사는 명사나 주어의 상태를, 부사는 동작이나 형용사를 꾸며요.','형용사 ↔ 부사',[
    {title:'역할',examples:[['adjective','She is a careful driver.','그녀는 조심스러운 운전자다.'],['adverb','She drives carefully.','그녀는 조심스럽게 운전한다.']]},
    {title:'연결동사 뒤',note:'look, feel, sound 같은 연결동사 뒤에는 보통 부사가 아니라 형용사가 와요.'}
  ],ex('He answered the question ___.',['① correct','② correctly','③ correctness'],'② correctly','answered라는 동작을 꾸미므로 부사 correctly가 맞아요.'),[['명사/상태','형용사'],['동작 꾸밈','부사']]),

  'prepositions':g('전치사','시간, 장소, 방향, 방법의 관계를 나타내는 작은 단어들이에요.','전치사 + 명사 / 대명사 / V-ing',[
    {title:'시간·장소',table:[['at','정확한 시각/지점'],['on','요일/날짜/표면'],['in','월/연도/넓은 공간']]},
    {title:'교통수단',examples:[['by','I go to school by bus.','나는 버스로 학교에 간다.']]},
    {title:'뒤 형태',note:'전치사 뒤에 동사가 오면 보통 V-ing 형태를 사용해요.'}
  ],ex('We usually go there ___ train.',['① by','② on','③ with'],'① by','교통수단을 방법으로 말할 때 by + 교통수단을 써요.'),[['시간','at / on / in'],['교통','by + 교통수단']]),

  'conjunctions':g('접속사','두 단어나 절을 연결해서 이유, 대조, 조건 등의 관계를 나타내요.','and / but / because / although ...',[
    {title:'대조',examples:[['but','He is tired, but he keeps working.','그는 피곤하지만 계속 일한다.'],['although','Although he is tired, he keeps working.','그는 피곤하지만 계속 일한다.']]},
    {title:'주의',note:'Although ... but ...처럼 although와 but을 한 문장에 함께 쓰지 않아요.'}
  ],ex('___ it was raining, we went outside.',['① Although','② But','③ So'],'① Although','뒤에 완전한 절을 이끌며 양보 의미를 나타내므로 Although가 맞아요.'),[['대조','but / although'],['주의','although와 but 중 하나']]),

  'indirect-questions':g('간접의문문','질문을 문장 속에 넣을 때 의문문 어순이 아니라 평서문 어순을 써요.','의문사 + 주어 + 동사',[
    {title:'직접 → 간접',table:[['Where is he?','Do you know where he is?'],['What does she want?','I wonder what she wants.']]},
    {title:'주의',note:'간접의문문에서는 where is he가 아니라 where he is예요.'}
  ],ex('Do you know where ___.',['① is he','② he is','③ does he'],'② he is','간접의문문은 의문사 + 주어 + 동사 어순이에요.'),[['어순','의문사 + 주어 + 동사'],['do/does','보통 사라짐']]),

  'countability':g('셀 수 있는·없는 명사','명사가 셀 수 있는지에 따라 a/an, many, much 등의 표현이 달라져요.','countable / uncountable',[
    {title:'셀 수 있는 명사',examples:[['many','many books','많은 책들']]},
    {title:'셀 수 없는 명사',examples:[['much','much water','많은 물'],['advice','some advice','약간의 조언']]},
    {title:'주의',note:'advice, information 등은 보통 a/an이나 복수 -s를 붙이지 않아요.'}
  ],ex('She gave me some ___.',['① advices','② advice','③ an advice'],'② advice','advice는 셀 수 없는 명사예요.'),[['countable','a/an · many · few'],['uncountable','much · little · some']]),

  'sentence-patterns':g('문장 형식과 어순','영어 문장은 동사가 어떤 성분을 필요로 하는지에 따라 기본 구조가 달라져요.','S + V (+ O / C / IO + DO)',[
    {title:'3형식',examples:[['SVO','I like music.','나는 음악을 좋아한다.']]},
    {title:'4형식',examples:[['SVOO','She gave me a gift.','그녀는 나에게 선물을 주었다.']]},
    {title:'어순',note:'영어는 주어-동사의 위치가 중요해서 단어를 한국어식으로 자유롭게 옮기면 안 돼요.'}
  ],ex('다음 단어를 바르게 배열한 것은? me / gave / she / a gift',['① She gave me a gift.','② She me gave a gift.','③ Gave she me a gift.'],'① She gave me a gift.','4형식은 주어 + 동사 + 사람 + 사물 순서예요.'),[['3형식','S + V + O'],['4형식','S + V + IO + DO']]),

  'parallel-structure':g('병렬구조','and, or 등으로 연결되는 요소는 문법적으로 같은 형태를 맞추는 것이 기본이에요.','A and B → 같은 형태',[
    {title:'동사 형태 맞추기',examples:[['-ing','She likes reading and drawing.','그녀는 독서와 그림 그리기를 좋아한다.'],['to V','He wants to travel and to learn.','그는 여행하고 배우고 싶어 한다.']]},
    {title:'주의',note:'reading and to draw처럼 연결된 두 요소의 형태가 어긋나는지 확인해요.'}
  ],ex('She enjoys singing and ___.',['① dance','② dancing','③ to dance'],'② dancing','and로 연결된 singing과 같은 -ing 형태를 맞춰요.'),[['and/or','연결 요소 형태 맞추기'],['체크','품사와 동사 형태']]),

  'sentence-transformation':g('문장 전환','형태는 달라도 같은 의미가 되도록 문장을 바꾸는 문제예요.','같은 의미 + 다른 구조',[
    {title:'4형식 전환',examples:[['give','She gave me a pen. = She gave a pen to me.','두 문장은 같은 뜻이에요.']]},
    {title:'비교 표현 전환',examples:[['not as','Tom is taller than Jim. = Jim is not as tall as Tom.','비교급과 as...as를 바꿀 수 있어요.']]},
    {title:'풀이법',note:'먼저 의미가 같은지 확인하고, 바뀐 구조에서 필요한 전치사·동사형을 확인해요.'}
  ],ex('Dad bought me a bag.와 같은 뜻은?',['① Dad bought a bag to me.','② Dad bought a bag for me.','③ Dad bought for me a bag.'],'② Dad bought a bag for me.','buy는 4형식을 바꿀 때 for를 써요.'),[['1단계','의미 확인'],['2단계','구조·전치사 확인']]),

  'conditionals':g('조건문','어떤 조건이 충족될 때 일어나는 결과를 if절로 표현해요.','If + 현재, will + V',[
    {title:'가능한 미래 조건',examples:[['if','If it rains, we will stay home.','비가 오면 우리는 집에 있을 것이다.']]},
    {title:'주의',note:'미래 의미라도 if절 안에서는 보통 will이 아니라 현재시제를 써요.'}
  ],ex('If she ___ early, we will start together.',['① will come','② comes','③ came'],'② comes','조건의 if절에서는 미래 의미라도 현재시제를 써요.'),[['if절','현재시제'],['결과절','will + 동사원형']])
});
