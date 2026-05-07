const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('greeting_response.json', 'utf8'));

// 그리팅 API 응답 구조: { success, data: { datas: [...] } }
const openings = raw.data?.datas ?? raw.data?.content ?? raw.data ?? raw.content ?? raw ?? [];

// 제목 기반 카테고리 분류 (title만 사용해 오탐 방지)
function getCategory(title) {
  const t = title.toLowerCase();
  if (/\bml\b|researcher|리서처/.test(t))                              return { cat: 'ml',      tag: 'ML / AI' };
  if (/engineer|engineering|frontend|front-end|backend|back-end|mobile|sre|devops/.test(t)) return { cat: 'eng', tag: 'Engineering' };
  if (/\bpo\b|\bpm\b|product owner|product manager|프로덕트/.test(t)) return { cat: 'product',  tag: 'Product' };
  if (/전략기획|strategy|planning|마케팅|marketing|biz dev/.test(t))  return { cat: 'biz',      tag: 'Business' };
  if (/cs담당|customer|모니터링|monitoring|intern|global team|운영/.test(t)) return { cat: 'ops', tag: 'Operations' };
  if (/채용|인사|hr|recruiting/.test(t))                               return { cat: 'mgmt',    tag: 'Management' };
  return { cat: 'biz', tag: 'Business' };
}

// 고용 형태 — API 응답에서 추출, 없으면 제목으로 추정
function getLoc(opening) {
  const info = opening.openingJobPositionInfo;

  // API 필드 탐색 (여러 경로 시도)
  const rawTypes =
    info?.employmentTypes ??
    info?.openingJobPositionSetting?.employmentTypes ??
    info?.jobPositions?.[0]?.employmentTypes ??
    [];

  const typeMap = {
    FULL_TIME: '정규직', FULLTIME: '정규직',
    CONTRACT: '계약직',
    INTERN: '인턴',
    FREELANCER: '프리랜서',
    PARTTIME: '파트타임',
  };

  // 제목에서 고용형태 fallback
  const t = (opening.title || '').toLowerCase();
  let empLabel = '정규직';
  if (rawTypes.length > 0) {
    empLabel = typeMap[rawTypes[0]] ?? rawTypes[0];
  } else if (/intern|인턴/.test(t))         empLabel = '인턴';
  else if (/freelanc|프리랜서/.test(t))     empLabel = '프리랜서';
  else if (/계약직|contract/.test(t))       empLabel = '계약직';

  return `서울 · ${empLabel}`;
}

// 경력 요건
function getExp(opening) {
  const info = opening.openingJobPositionInfo;
  const careers =
    info?.careerTypes ??
    info?.openingJobPositionSetting?.careerTypes ??
    info?.jobPositions?.[0]?.careerTypes ??
    [];

  const hasNew = careers.some(c => /new|신입/i.test(c));
  const hasExp = careers.some(c => /experienced|경력/i.test(c));
  if (hasNew && hasExp) return '신입 / 경력';
  if (hasNew)  return '신입';
  if (hasExp)  return '경력';
  return '경력 무관';
}

// URL에 https:// 없으면 추가
function fixUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http')) return url;
  return 'https://' + url;
}

if (!Array.isArray(openings) || openings.length === 0) {
  console.error('No openings found. Response:', JSON.stringify(raw).slice(0, 300));
  process.exit(1);
}

const EXCLUDE_KEYWORDS = ['티타임', '인재풀', 'talent pool'];

const positions = openings
  .filter(o => o.activatedAtCareerPage !== false)
  .filter(o => !EXCLUDE_KEYWORDS.some(kw => o.title?.toLowerCase().includes(kw.toLowerCase())))
  .map(o => ({
    title: o.title.trim(),
    ...getCategory(o.title),
    exp: getExp(o),
    loc: getLoc(o),
    url: fixUrl(o.url),
  }));

const output = `/* ─────────────────────────────────────────────────────────────
   POSITIONS — 그리팅 API에서 자동 생성됨 (GitHub Actions)
   마지막 업데이트: ${new Date().toISOString()}
   ───────────────────────────────────────────────────────────── */
const POSITIONS = ${JSON.stringify(positions, null, 2)};
`;

fs.writeFileSync('positions.js', output);
console.log(`✅ ${positions.length}개 포지션 생성 완료`);
positions.forEach(p => console.log(`  [${p.cat}] ${p.title} — ${p.loc}`));
