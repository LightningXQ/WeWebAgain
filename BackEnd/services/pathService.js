// services/pathService.js
const axios = require('axios');

/**
 * ODsay API Key
 * - .env를 안 쓴다면 아래 하드코드 자리에 "실제 발급키"를 넣으면 됩니다.
 * - .env를 쓴다면 ODSAY_API_KEY 환경변수로 주입하세요.
 */
const ODSAY_API_KEY = (process.env.ODSAY_API_KEY || '').trim();

// (선택) 콘솔에서 앞/뒤 4자리만 확인
function maskKey(k) {
  if (!k) return '(empty)';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
console.log('[pathService] ODsay key:', maskKey(ODDSAY_API_KEY = ODSAY_API_KEY)); // 키 확인용

/**
 * 경로 검색
 * @param {{sx:number, sy:number, ex:number, ey:number, pathIndex?:number}} params
 * @returns {Promise<{ pathList: any[], path: any|null, subPaths: any[], totalPayment: number|null, totalTime: number|null }>}
 */
async function searchPath({ sx, sy, ex, ey, pathIndex }) {
  // 파라미터 검증
  const required = { sx, sy, ex, ey };
  for (const [k, v] of Object.entries(required)) {
    if (v === undefined || v === null || v === '') {
      throw new Error(`searchPath: ${k} is required`);
    }
  }
  if (!ODsayKeyOk()) {
    const e = new Error('ODSAY_API_KEY is missing');
    e.name = 'ConfigError';
    throw e;
  }

  // ODsay 호출
  const url = 'https://api.odsay.com/v1/api/searchPubTransPath';
  try {
    const { data, status } = await axios.get(url, {
      params: {
        apiKey: ODSAY_API_KEY,
        SX: sx,
        SY: sy,
        EX: ex,
        EY: ey,
        output: 'json',
      },
      timeout: 15000,
      // validateStatus: () => true, // (원한다면) 200 이외도 data만 받게
    });

    // HTTP 단계 에러
    if (status !== 200) {
      const err = new Error(`ODsay HTTP ${status}`);
      err.name = 'ODsayHttpError';
      err.httpStatus = status;
      throw err;
    }

    // ODsay 포맷 에러 (ODsay는 200이어도 body에 error가 들어올 수 있음)
    if (data && data.error && typeof data.error.code !== 'undefined') {
      const err = new Error(data.error.msg || 'ODsay error');
      err.name = 'ODsayError';
      err.odsay = { code: data.error.code, msg: data.error.msg };
      throw err;
    }

    const pathList = data?.result?.path || [];
    if (!Array.isArray(pathList) || pathList.length === 0) {
      const err = new Error('No path found');
      err.name = 'ODsayNoPath';
      err.raw = data;
      throw err;
    }

    // 경로 선택: pathIndex가 유효하면 그걸, 없으면 ODsay가 준 0번(보통 최적)
    let idx = Number.isInteger(pathIndex) ? pathIndex : 0;
    if (idx < 0 || idx >= pathList.length) idx = 0;

    const path = pathList[idx] || null;
    const subPaths = path?.subPath || [];
    const totalPayment = path?.info?.payment ?? null;
    const totalTime = path?.info?.totalTime ?? null;

    return { pathList, path, subPaths, totalPayment, totalTime };
  } catch (err) {
    // axios/네트워크/타임아웃
    if (!err.name) err.name = 'ODsayUnknownError';
    throw err;
  }
}

function ODsayKeyOk() {
  return typeof ODSAY_API_KEY === 'string' && ODSAY_API_KEY.length > 0;
}

module.exports = { searchPath };
