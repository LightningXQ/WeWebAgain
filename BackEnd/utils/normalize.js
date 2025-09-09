 // ✅ 노선명 비교를 위한 정규화 함수
  function normalizeLineName(name) {
    return name.replace(/\s/g, '')
              .replace(/도시철도/g, '')
              .replace(/호선/g, '')
              .trim();
  }

  function normalizeStopName(name) {
    return (name || '')
      .replace(/\s+/g, '')     // 공백 제거
      .replace(/\(.*?\)/g, '') // 괄호 안 제거
      .replace(/역$/g, '')     // 끝의 '역' 제거(버스/지하철 혼용 대비)
      .trim();
  }

  // "1001(심야)" → "1001", "1001번" → "1001"
  function normalizeBusRouteId(s) {
    return String(s || '')
      .replace(/\(.*?\)/g, '')  // 괄호 및 내용 제거
      .replace(/\s+/g, '')      // 공백 제거
      .replace(/번$/g, '');     // 끝의 '번' 제거
  }

  // dayType 표준화: 요청값을 지하철/버스 키로 동시 변환
  // 사람이 입력한 요일을 두 시스템(지하철/버스) 키로 동시 변환
  function resolveDayType(input) {
    const s = String(input || '').trim().toLowerCase();

    // 평일
    if (['평일','weekday','week','wd'].includes(s)) {
      return { subway: '평일', bus: 'week' };
    }
    // 토요일 -> 지하철: '토요일', 버스: 'holi' (요청사항)
    if (['토','토요일','sat','saturday'].includes(s)) {
      return { subway: '토요일', bus: 'holi' };
    }
    // 일요일/휴일/holiday/holi -> 지하철: '휴일', 버스: 'holi'
    if (['일','일요일','sun','sunday','휴일','holiday','holi'].includes(s)) {
      return { subway: '휴일', bus: 'holi' };
    }

    // 입력이 없으면 오늘 날짜로 추론
    const now = new Date();
    const dow = now.getDay(); // 0=일, 6=토
    if (dow === 6) return { subway: '토요일', bus: 'holi' };
    if (dow === 0) return { subway: '휴일', bus: 'holi' };
    return { subway: '평일', bus: 'week' };
  }

  // (버스) day 값을 bus 키로 환산 (객체/문자 모두 허용)
  function dayTypeToBusKey(day) {
    const raw = typeof day === 'object' && day?.bus ? day.bus : day;
    const s = String(raw || '').trim().toLowerCase();
    if (['week','weekday','평일'].includes(s)) return 'week';
    // 토/일/휴일 전부 holi 로
    return 'holi';
  }

  // (지하철) day 값을 ODCloud의 요일구분 키로 환산 (객체/문자 모두 허용)
  function dayTypeToSubwayKey(day) {
    const raw = typeof day === 'object' && day?.subway ? day.subway : day;
    const s = String(raw || '').trim().toLowerCase();
    if (['토','토요일','sat','saturday'].includes(s)) return '토요일';
    if (['일','일요일','sun','sunday','휴일','holiday','holi'].includes(s)) return '휴일';
    return '평일';
  }

  module.exports = {
    normalizeLineName,
    normalizeStopName,
    normalizeBusRouteId,
    resolveDayType,
    dayTypeToBusKey,
    dayTypeToSubwayKey,
  };
