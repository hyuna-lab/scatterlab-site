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
  if (/cs담당|\bcs\b|customer|모니터링|monitoring|intern|global team|운영|operation/.test(t)) return { cat: 'ops', tag: 'Operations' };
  if (/채용|인사|\bhr\b|recruiting|talent acquisition|\bta\b/.test(t)) return { cat: 'mgmt',    tag: 'Management' };
  return { cat: 'biz', tag: 'Business' };
}

// 고용 형태
function getLoc(opening) {
  const info = opening.openingJobPositionInfo;
  const emp = info?.openingJobPositions?.[0]?.jobPositionEmployment?.employment;

  const typeMap = {
    FULL_TIME_WORKER: '정규직',
    INTERN_WORKER: '인턴',
    FREE_LANCER: '프리랜서',
    CONTRACT_WORKER: '계약직',
    PART_TIME_WORKER: '파트타임',
  };

  const t = (opening.title || '').toLowerCase();
  let empLabel = '정규직';
  if (emp) {
    empLabel = typeMap[emp] ?? '정규직';
  } else if (/intern|인턴/.test(t))       empLabel = '인턴';
  else if (/freelanc|프리랜서/.test(t))   empLabel = '프리랜서';
  else if (/계약직|contract/.test(t))     empLabel = '계약직';

  return `서울 · ${empLabel}`;
}

// API가 null을 반환하는 포지션의 경력 수동 보정 (opening ID → 경력 레이블)
const CAREER_OVERRIDES = {
  206237: '경력 3년 이상',           // Front-end Engineer
  206309: '경력 3년 이상',           // Mobile Engineer (React Native)
  205480: '경력 2년 이상 ~ 8년 이하', // zeta 전략기획 매니저
};

// 경력 요건
function getExp(opening) {
  if (CAREER_OVERRIDES[opening.id]) return CAREER_OVERRIDES[opening.id];

  const info = opening.openingJobPositionInfo;
  const career = info?.openingJobPositions?.[0]?.jobPositionCareer;

  if (!career) return '경력 무관';

  const { careerType, careerFrom, careerTo } = career;
  if (careerType === 'EXPERIENCED') {
    if (careerFrom && careerTo) return `경력 ${careerFrom}~${careerTo}년`;
    if (careerFrom) return `경력 ${careerFrom}년 이상`;
    return '경력직';
  }
  if (careerType === 'NEW') return '신입';
  return '경력 무관';
}

// URL 정규화: https:// 추가 + /ko/ 경로 보장
function fixUrl(url, id) {
  if (!url) return `https://www.scatterlab.co.kr/ko/o/${id}`;
  if (!url.startsWith('http')) url = 'https://' + url;
  // /o/ → /ko/o/ 변환 (이미 /ko/ 있으면 스킵)
  if (!url.includes('/ko/')) url = url.replace('/o/', '/ko/o/');
  return url;
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
