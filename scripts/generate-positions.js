const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('greeting_response.json', 'utf8'));

// 그리팅 API 응답 구조: { success, data: { datas: [...] } }
const openings = raw.data?.datas ?? raw.data?.content ?? raw.data ?? raw.content ?? raw ?? [];

function getCategory(opening) {
  const text = (opening.title + JSON.stringify(opening.openingJobPositionInfo ?? '')).toLowerCase();
  if (/ml|ai|researcher|리서처/.test(text))                          return { cat: 'ml',      tag: 'ML / AI' };
  if (/engineer|engineering|frontend|backend|mobile|sre|devops/.test(text)) return { cat: 'eng',     tag: 'Engineering' };
  if (/product|pm|po|프로덕트/.test(text))                           return { cat: 'product',  tag: 'Product' };
  if (/전략|strategy|planning|business|마케팅|marketing/.test(text)) return { cat: 'biz',      tag: 'Business' };
  if (/cs|customer|운영|monitoring|intern|global/.test(text))        return { cat: 'ops',      tag: 'Operations' };
  return { cat: 'mgmt', tag: 'Management' };
}

function getExp(opening) {
  const info = opening.openingJobPositionInfo;
  const careers = info?.careerTypes ?? info?.careers ?? [];
  const hasNew  = careers.some(c => /new|신입/i.test(c));
  const hasExp  = careers.some(c => /experienced|경력/i.test(c));
  if (hasNew && hasExp) return '신입 / 경력';
  if (hasNew)  return '신입';
  if (hasExp)  return '경력';
  return '경력 무관';
}

function getLoc(opening) {
  const info = opening.openingJobPositionInfo;
  const types = info?.employmentTypes ?? info?.employmentType ?? [];
  const typeMap = {
    FULL_TIME: '정규직', CONTRACT: '계약직',
    INTERN: '인턴', FREELANCER: '프리랜서', PARTTIME: '파트타임'
  };
  const empType = typeMap[types[0]] ?? types[0] ?? '정규직';
  return `서울 · ${empType}`;
}

if (!Array.isArray(openings) || openings.length === 0) {
  console.error('No openings found. API response:', JSON.stringify(raw).slice(0, 300));
  process.exit(1);
}

const positions = openings
  .filter(o => o.activatedAtCareerPage !== false)
  .map(o => ({
    title: o.title,
    ...getCategory(o),
    exp: getExp(o),
    loc: getLoc(o),
    url: o.url ?? `https://www.scatterlab.co.kr/ko/o/${o.id}`
  }));

const output = `/* ─────────────────────────────────────────────────────────────
   POSITIONS — 그리팅 API에서 자동 생성됨 (GitHub Actions)
   마지막 업데이트: ${new Date().toISOString()}
   ───────────────────────────────────────────────────────────── */
const POSITIONS = ${JSON.stringify(positions, null, 2)};
`;

fs.writeFileSync('positions.js', output);
console.log(`✅ ${positions.length}개 포지션 생성 완료`);
