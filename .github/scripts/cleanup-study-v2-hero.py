from pathlib import Path
import re

root = Path('students/study-v2')

# index.html: markup + asset loading only. No hero CSS inline.
p = root / 'index.html'
s = p.read_text()
s, n = re.subn(
    r'\n<style>\s*/\* Keep the Daily, AI and book launch actions captured.*?</style>\n',
    '\n', s, count=1, flags=re.S
)
if n != 1:
    raise SystemExit('Expected Study V2 inline hero style block was not found')

s = s.replace(
    ' class="hero-actions" hidden aria-hidden="true" style="display:none!important"',
    ' class="hero-actions" hidden aria-hidden="true"'
)
s = re.sub(
    r'\s*<link rel="stylesheet" href="\./v2-daily-rail-impact\.css\?v=[^"]+">\n',
    '\n', s, count=1
)

versions = {
    './v2-top-layout.css?v=20260815-bookspacing2': './v2-top-layout.css?v=20260816-heroclean1',
    './v2-daily-journey.css?v=20260816-railhero2': './v2-daily-journey.css?v=20260816-heroclean1',
    './v2-daily-spark.css?v=20260816-spark2': './v2-daily-spark.css?v=20260816-heroclean1',
    './v2-activity-ux.css?v=20260816-activityux4': './v2-activity-ux.css?v=20260816-heroclean1',
    './v2-daily-rail-impact.js?v=20260816-spark1': './v2-daily-rail-impact.js?v=20260816-heroclean1',
}
for old, new in versions.items():
    if old not in s:
        raise SystemExit(f'Missing expected asset reference: {old}')
    s = s.replace(old, new)
p.write_text(s)

# v2-top-layout.css: base launcher/card styling only.
p = root / 'v2-top-layout.css'
s = p.read_text()
marker = '/* Book switcher, title, units and mastery all belong to one book-level container. */'
if marker not in s:
    raise SystemExit('v2-top-layout.css marker missing')
head, tail = s.split(marker, 1)
head = head.replace('!important', '')

moved = '''
/* Top launcher shell. Kept here instead of inline in index.html. */
.study-v2-top-actions{
  padding:18px;
  gap:12px;
  margin:0 0 34px;
  border:2px solid var(--arcade-pink);
  border-radius:28px;
  background:#fff;
  box-shadow:0 10px 30px rgba(38,74,79,.07);
  overflow:hidden;
}
.study-v2-top-actions>.study-v2-action-card,
#dailyWorkoutCard.study-v2-daily-primary{box-shadow:none}
#dailyWorkoutCard.study-v2-daily-primary,
#dailyWorkoutCard.study-v2-daily-primary.is-complete,
#dailyWorkoutCard.study-v2-daily-primary:hover,
#dailyWorkoutCard.study-v2-daily-primary:focus-visible{
  border:3px solid #d4dadd;
  box-shadow:0 8px 22px rgba(38,74,79,.08);
}
.study-v2-top-actions>.study-v2-action-card:hover,
.study-v2-top-actions>.study-v2-action-card:focus-visible{
  box-shadow:0 7px 18px rgba(38,74,79,.07);
}
.study-v2-top-actions .daily-rail-main{
  margin:0;
  border-radius:20px;
}
@media (min-width:760px){
  .study-v2-top-actions{
    display:grid;
    grid-template-columns:minmax(0,1.35fr) minmax(250px,.65fr);
    align-items:stretch;
    padding:20px;
    gap:12px 14px;
  }
  #dailyWorkoutCard.study-v2-daily-primary,
  .study-v2-top-actions .daily-rail-main{grid-column:1}
  #practiceHeroBtn,
  #bookStudyBtn,
  #bookPracticeBtn{
    grid-column:2;
    min-height:88px;
    padding:14px 16px;
  }
  #practiceHeroBtn{grid-row:1}
  #bookStudyBtn{grid-row:2}
  #bookPracticeBtn{grid-row:3}
  #dailyWorkoutCard.study-v2-daily-primary{grid-row:1 / span 2}
  .study-v2-top-actions .daily-rail-main{grid-row:3}
}
@media (max-width:560px){
  .study-v2-top-actions{
    padding:12px;
    gap:10px;
    border-radius:24px;
    margin-bottom:30px;
  }
  .study-v2-top-actions>.study-v2-action-card,
  #dailyWorkoutCard.study-v2-daily-primary{border-radius:18px}
}

'''
p.write_text(head.rstrip() + '\n\n' + moved + marker + tail)

# v2-daily-spark.css: phone presentation only; keep landscape-phone decoration.
p = root / 'v2-daily-spark.css'
s = p.read_text()
wide_marker = '/* Wide tablets / desktop: preserve Daily Rail structure but give the whole hero the Spark identity. */'
if wide_marker not in s:
    raise SystemExit('v2-daily-spark.css wide marker missing')
phone, wide_tail = s.split(wide_marker, 1)
landscape_marker = '@media (orientation:landscape) and (min-width:600px) and (max-height:700px){'
if landscape_marker in wide_tail:
    landscape = landscape_marker + wide_tail.split(landscape_marker, 1)[1]
    s = phone.rstrip() + '\n\n/* Landscape-phone Spark decoration. */\n' + landscape
else:
    s = phone.rstrip() + '\n'
p.write_text(s)

# v2-daily-journey.css: one owner for wide/tablet hero layout.
p = root / 'v2-daily-journey.css'
s = p.read_text().replace('!important', '')

s = s.replace(
    '    border:0;\n    border-right:1px solid #f3d7e4;\n    border-radius:26px 0 0 26px;',
    '    border:3px solid #d4dadd;\n    border-radius:26px;'
)

s = s.replace(
    '.book-hero.daily-inline .study-v2-top-actions>#bookPracticeBtn{grid-column:3;grid-row:2}\n'
    '  .book-hero.daily-inline .study-v2-top-actions>#bookStudyBtn{grid-column:4;grid-row:2}',
    '.book-hero.daily-inline .study-v2-top-actions>#bookStudyBtn{grid-column:3;grid-row:2}\n'
    '  .book-hero.daily-inline .study-v2-top-actions>#bookPracticeBtn{grid-column:4;grid-row:2}'
)

tablet_pattern = re.compile(
    r'@media \(min-width:760px\) and \(max-width:1024px\)\{.*?\n\}',
    re.S
)
tablet = '''@media (min-width:760px) and (max-width:1024px){
  /* Tablet: the outer rail is open. Daily Study itself owns the pink frame. */
  .book-hero.daily-inline .study-v2-top-actions{
    grid-template-columns:300px repeat(3,minmax(0,1fr));
    grid-template-rows:222px 104px;
    gap:14px;
    padding:0;
    border:0;
    border-radius:0;
    background:transparent;
    box-shadow:none;
    overflow:visible;
  }

  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary{
    grid-column:1;
    grid-row:1 / span 2;
    align-self:stretch;
    min-height:340px;
    padding:26px 22px 22px;
    border:3px solid var(--arcade-pink);
    border-radius:28px;
    background:linear-gradient(180deg,#fff3f8 0%,#fff 100%);
    box-shadow:0 10px 28px rgba(38,74,79,.07);
  }
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary:hover,
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary:focus-visible{
    border-color:var(--arcade-pink);
    background:linear-gradient(180deg,#fff1f7 0%,#fff 100%);
    box-shadow:0 12px 30px rgba(38,74,79,.09);
  }
  .book-hero.daily-inline .daily-rail-today{font-size:.82rem;margin-bottom:10px}
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary strong{font-size:1.42rem}

  /* Progress is deliberately the visual anchor on tablets. */
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary .progress-ring{
    width:220px;
    height:220px;
    flex:0 0 220px;
    margin:20px auto 0;
    box-shadow:0 0 0 7px rgba(255,111,176,.07);
  }
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary .progress-ring:after{inset:24px}
  .book-hero.daily-inline #dailyWorkoutCard.study-v2-daily-primary .progress-ring span{font-size:1.65rem}

  .book-hero.daily-inline .daily-rail-main{
    grid-column:2 / 5;
    grid-row:1;
    padding:26px 24px 14px;
  }
  .book-hero.daily-inline .daily-rail-headline{font-size:1.65rem}
  .book-hero.daily-inline .daily-rail-sub{font-size:.92rem}
  .book-hero.daily-inline .daily-rail-progress{margin-top:20px;gap:8px}

  .book-hero.daily-inline .study-v2-top-actions>#practiceHeroBtn{grid-column:2;grid-row:2}
  .book-hero.daily-inline .study-v2-top-actions>#bookStudyBtn{grid-column:3;grid-row:2}
  .book-hero.daily-inline .study-v2-top-actions>#bookPracticeBtn{grid-column:4;grid-row:2}
  .book-hero.daily-inline .study-v2-top-actions>.study-v2-action-card:not(#dailyWorkoutCard){
    min-height:104px;
    padding:14px 16px;
    gap:14px;
  }
  .book-hero.daily-inline .study-v2-top-actions>.study-v2-action-card:not(#dailyWorkoutCard):before{
    width:62px;
    height:62px;
    flex:0 0 62px;
    border-radius:0;
    background-color:transparent;
    background-size:44px 44px;
  }
  .book-hero.daily-inline .study-v2-top-actions>.study-v2-action-card:not(#dailyWorkoutCard)>strong{
    font-size:1.22rem;
    line-height:1.12;
  }
  .book-hero.daily-inline .study-v2-top-actions>.study-v2-action-card:not(#dailyWorkoutCard)>small{
    font-size:.76rem;
    margin-top:4px;
  }

  .header-skill-mastery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}'''
s, n = tablet_pattern.subn(tablet, s, count=1)
if n != 1:
    raise SystemExit('Tablet block in v2-daily-journey.css not found')
p.write_text(s)

# v2-daily-rail-impact.js: behavior/data only; no injected visual CSS.
p = root / 'v2-daily-rail-impact.js'
s = p.read_text()
s, n = re.subn(
    r'/\* Top launcher frame:.*?\*/\s*\(function\(\)\{.*?\}\)\(\);\s*',
    '', s, count=1, flags=re.S
)
if n != 1:
    raise SystemExit('Runtime hero CSS injection not found')
s = s.replace(", 'important')", ")")
s = s.replace(",'important')", ")")
p.write_text(s)

# v2-activity-ux.css: activities only.
p = root / 'v2-activity-ux.css'
s = p.read_text()
s, n = re.subn(
    r'\n/\* Final launcher-card border authority\..*?\n\}',
    '', s, count=1, flags=re.S
)
if n != 1:
    raise SystemExit('Launcher override in v2-activity-ux.css not found')
p.write_text(s.rstrip() + '\n')

# Retire redundant wide/tablet tuning CSS.
impact_css = root / 'v2-daily-rail-impact.css'
if impact_css.exists():
    impact_css.unlink()

# Remove temporary tooling in the same commit.
Path('.github/scripts/cleanup-study-v2-hero.py').unlink()
Path('.github/workflows/cleanup-study-v2-hero-once.yml').unlink()
