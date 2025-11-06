// Lightweight language manager (EN/KR) without altering existing styles/fonts.
// Usage: include this script, add data-i18n="Key" to elements.
// Call StudentLang.setLang('ko'|'en') to toggle. Persisted via localStorage.

(function(){
	const LANG_KEY = 'student_ui_lang';
	// Determine initial default from system preference (one-time) unless stored
	let systemDefault = 'en';
	try { const sys = (navigator.language || navigator.userLanguage || 'en').toLowerCase(); if(sys.startsWith('ko')) systemDefault = 'ko'; } catch {}
	const DEFAULT = systemDefault;
	const USER_FLAG = 'student_ui_lang_user'; // set once user explicitly changes
	// If language stored previously but no explicit user flag, allow system preference to override once
	try {
		const existing = localStorage.getItem(LANG_KEY);
		if(!existing) {
			localStorage.setItem(LANG_KEY, DEFAULT);
		} else if(!localStorage.getItem(USER_FLAG) && existing !== DEFAULT) {
			localStorage.setItem(LANG_KEY, DEFAULT);
		}
	} catch {}
	const map = {
		en: {
				'Dashboard':'Dashboard','Welcome':'Welcome','Start Playing':'Start Playing','Account':'Account','Settings':'Settings','Your Work':'Your Work','Class':'Class','Coming soon':'Coming soon','Back':'Back',
			'Start':'Start','Start Game Now':'Start Game Now','More Games':'More Games','Kor':'Kor','Eng':'Eng',
			'Word Arcade':'Word Arcade','Grammar Arcade':'Grammar Arcade','Challenge Zone':'Challenge Zone','My Profile':'My Profile','Change Password':'Change Password','Change Email':'Change Email','View Profile':'View Profile','Logout':'Logout','Language':'Language','Korean':'Korean','English':'English','Dark Mode':'Dark Mode','Music':'Music','Off':'Off','Arcade Tagline':'Master English with word arcade and grammar arcade',
			'Basic':'Basic','Your Work (Short)':'Your Work','3X Challenge':'3X Challenge','Word Games':'Word Games','Grammar Games':'Grammar Games','Your Homework':'Willena Homework','X3 Point Challenge':'X3 Point Challenge','Discover':'Willena Other Class Homework','Word Games Subtitle':'Learn words and level up!','Grammar Games Subtitle':'Build perfect sentences!','X3 Point Challenge Subtitle':'Master tough words for 3x rewards!','Loading game…':'Loading game…','Menu':'Menu','Levels':'Levels','Level 0: Phonics':'Level 0: Phonics','Level 1: Easy':'Level 1: Easy','Level 2':'Level 2','Level 3':'Level 3','Level 4':'Level 4','Level 5':'Level 5',
			'Student Login':'Student Login','Use your username and password.':'Use your username and password.','Username':'Username','Password':'Password','Log in':'Log in','Guest Login':'Guest Login','Please enter both username and password.':'Please enter both username and password.','Enter your name to play as a guest:':'Enter your name to play as a guest:','Login failed':'Login failed','Guest login failed':'Guest login failed','Username not found':'Username not found',
			'English Name':'English Name','Korean Name':'Korean Name','Email':'Email','Points':'Points','Medals':'Medals','Stars':'Stars','Badges':'Badges','Your Awards':'Your Awards','Your Badges':'Your Badges','Choose your avatar':'Choose your avatar','Cancel':'Cancel','Save':'Save','Loading…':'Loading…','No badges earned yet.':'No badges earned yet.','Sign in to see your progress.':'Sign in to see your progress.',
			'Past Tense Game':'Past Tense Game','Cutie Past Tense':'Cutie Past Tense','Fruti':'Fruti','Easy Word Game':'Easy Word Game','Jungle Animal Game':'Jungle Animal Game','Go Goes':'Go Goes','School Stuff Game':'School Stuff Game','EB4 Unscramble':'EB4 Unscramble','ES6 Unscramble':'ES6 Unscramble','Past Participle Basher':'Past Participle Basher',
			'New Email':'New Email','Confirm Email':'Confirm Email','Email updated':'Email updated','Invalid email address':'Invalid email address','Email already in use':'Email already in use','Emails do not match':'Emails do not match','Show':'Show','Hide':'Hide',
			'Past Tense Quiz!':'Past Tense Quiz!','Eat or ate?':'Eat or ate?','Fruit & Veg Quiz!':'Fruit & Veg Quiz!','Random Words':'Random Words','Guess The Animals!':'Guess The Animals!','Is it "Go or Goes?"':'Is it "Go or Goes?"','Guess School Stuff':'Guess School Stuff','Unscramble Sentences!':'Unscramble Sentences!','Dramady Music':'Dramady Music','Past Participles!':'Past Participles!',
			'Phone':'Phone','All rights reserved.':'All rights reserved.','Home':'Home','Profile':'Profile','Games':'Games','Close':'Close','No badges earned yet.':'No badges earned yet.','No badges yet.':'No badges yet.','No challenging words yet.':'No challenging words yet.','Current Password':'Current Password','New Password':'New Password','Confirm Password':'Confirm Password','Password updated':'Password updated','Incorrect current password':'Incorrect current password','Passwords do not match':'Passwords do not match','Password must be at least 6 characters.':'Password must be at least 6 characters.','On':'On',
			// Mode menu labels
				'Match':'Match','Listen':'Listen','Read':'Read','Spell':'Spell','Sentence':'Sentence','Unscramble':'Unscramble','Level up':'Level up',
			'Listen & Pick':'Listen & Pick','Missing Letter':'Missing Letter','Read & Find':'Read & Find','Spell It Out':'Spell It Out',
			// Mode menu controls
			'Main Menu':'Main Menu','Change Level':'Change Level','Word List':'Word List','click here':'click here','How To Win':'How To Win'
		},
			ko: {
			// NOTE: User requested specific forms: Word Arcade => 단어 오락실, 3X Challenge => 3x 도전
				'Dashboard':'대시보드','Welcome':'환영합니다','Start Playing':'시작하기','Account':'계정','Settings':'설정','Your Work':'내 작업','Class':'반','Coming soon':'곧 제공','Back':'뒤로','Start':'시작','Start Game Now':'지금 게임 시작','More Games':'더 많은 게임','Kor':'한','Eng':'영','Word Arcade':'단어 오락실','Grammar Arcade':'문법 아케이드','Challenge Zone':'챌린지 존','My Profile':'내 프로필','Change Password':'비밀번호 변경','Change Email':'이메일 변경','View Profile':'프로필 보기','Logout':'로그아웃','Language':'언어','Korean':'한국어','English':'영어','Dark Mode':'다크 모드','Music':'음악','Off':'끔','Arcade Tagline':'단어 오락실과 문법 아케이드로 영어 실력을 키워 보세요',
			'Basic':'기초','Your Work (Short)':'내 작업','3X Challenge':'3x 도전','Word Games':'단어 게임','Grammar Games':'문법 게임','Your Homework':'Willena 숙제','X3 Point Challenge':'X3 포인트 도전','Discover':'Willena 다른 반 숙제','Word Games Subtitle':'단어를 배우고 레벨 업하세요!','Grammar Games Subtitle':'완벽한 문장을 만드세요!','X3 Point Challenge Subtitle':'어려운 단어를 마스터하고 3배 보상을 받으세요!','Loading game…':'게임 불러오는 중…','Menu':'메뉴','Levels':'레벨','Level 0: Phonics':'레벨 0: 파닉스','Level 1: Easy':'레벨 1: 쉬움','Level 2':'레벨 2','Level 3':'레벨 3','Level 4':'레벨 4','Level 5':'레벨 5',
			'Student Login':'학생 로그인','Use your username and password.':'사용자 이름과 비밀번호를 입력하세요.','Username':'사용자 이름','Password':'비밀번호','Log in':'로그인','Guest Login':'게스트 로그인','Please enter both username and password.':'아이디와 비밀번호를 모두 입력하세요.','Enter your name to play as a guest:':'게스트 이름을 입력하세요:','Login failed':'로그인 실패','Guest login failed':'게스트 로그인 실패','Username not found':'사용자 이름을 찾을 수 없습니다',
			'English Name':'영어 이름','Korean Name':'한국 이름','Email':'이메일','Points':'포인트','Medals':'메달','Stars':'별','Badges':'배지','Your Awards':'나의 보상','Your Badges':'나의 배지','Choose your avatar':'아바타 선택','Cancel':'취소','Save':'저장','Loading…':'로딩 중…','No badges earned yet.':'아직 배지가 없습니다.','Sign in to see your progress.':'진행 상황을 보려면 로그인하세요.',
			'Past Tense Game':'과거 시제 게임','Cutie Past Tense':'귀요미 과거형','Fruti':'프루티','Easy Word Game':'쉬운 단어 게임','Jungle Animal Game':'정글 동물 게임','Go Goes':'Go/Goes 게임','School Stuff Game':'학교 물건 게임','EB4 Unscramble':'EB4 문장 재배열','ES6 Unscramble':'ES6 문장 재배열','Past Participle Basher':'과거분사 게임',
			'New Email':'새 이메일','Confirm Email':'이메일 확인','Email updated':'이메일이 변경되었습니다','Invalid email address':'잘못된 이메일 주소입니다','Email already in use':'이미 사용 중인 이메일입니다','Emails do not match':'이메일이 일치하지 않습니다','Show':'표시','Hide':'숨기기',
			'Past Tense Quiz!':'과거 시제 퀴즈!','Eat or ate?':'eat 또는 ate?','Fruit & Veg Quiz!':'과일 & 야채 퀴즈!','Random Words':'무작위 단어','Guess The Animals!':'동물 맞히기!','Is it "Go or Goes?"':'"Go" 또는 "Goes"?','Guess School Stuff':'학교 물건 맞히기','Unscramble Sentences!':'문장 재배열!','Dramady Music':'드라마디 음악','Past Participles!':'과거분사!',
			'Phone':'전화','All rights reserved.':'판권 소유.','Home':'홈','Profile':'프로필','Games':'게임','Close':'닫기','No badges earned yet.':'아직 배지가 없습니다.','No badges yet.':'아직 배지가 없습니다.','No challenging words yet.':'아직 어려운 단어가 없습니다.','Current Password':'현재 비밀번호','New Password':'새 비밀번호','Confirm Password':'비밀번호 확인','Password updated':'비밀번호가 변경되었습니다','Incorrect current password':'현재 비밀번호가 올바르지 않습니다','Passwords do not match':'비밀번호가 일치하지 않습니다','Password must be at least 6 characters.':'비밀번호는 최소 6자 이상이어야 합니다.','On':'켬',
			// Mode menu labels (Korean)
				'Match':'짝 맞추기','Listen':'듣기','Read':'읽기','Spell':'철자 쓰기','Sentence':'문장','Unscramble':'문장 재배열','Level up':'레벨 업',
			'Listen & Pick':'듣고 선택하기','Missing Letter':'빠진 글자','Read & Find':'읽고 찾기','Spell It Out':'철자하기',
			// Mode menu controls
			'Main Menu':'메인 메뉴','Change Level':'레벨 변경','Word List':'단어 목록','click here':'여기를 클릭','How To Win':'이기는 방법'
		}
	};

	function getLang(){ return localStorage.getItem(LANG_KEY) || DEFAULT; }
	function translate(k){ const l=getLang(); return (map[l] && map[l][k]) || k; }
	let busy=false;
	function apply(){ if(busy) return; busy=true; document.querySelectorAll('[data-i18n]').forEach(el=>{ const key=el.getAttribute('data-i18n'); if(!key) return; // preserve child icons/images: only replace pure text nodes
			if(el.children.length===0 || el.tagName==='TITLE'){ el.textContent = translate(key); }
			else if(el.tagName==='A' || el.tagName==='BUTTON' || el.tagName==='SPAN'|| el.tagName==='DIV'){ // update first text node only
				const t = Array.from(el.childNodes).find(n=>n.nodeType===3); if(t) t.textContent = translate(key); }
		}); busy=false; }
	function setLang(lang){ if(!map[lang]) return; localStorage.setItem(LANG_KEY, lang); try{ localStorage.setItem(USER_FLAG,'1'); }catch{}; try{document.documentElement.setAttribute('lang', lang);}catch{}; apply(); try{ window.dispatchEvent(new CustomEvent('studentlang:changed',{detail:{lang}})); }catch{} }
	window.StudentLang = { getLang, setLang, translate, applyTranslations:apply };
	try { document.documentElement.setAttribute('lang', getLang()); } catch {}
	if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply); else apply();
	window.addEventListener('storage', e=>{ if(e.key===LANG_KEY) apply(); });
})();
