// ✅ 서비스 시간대 상수 추가
const SERVICE_START_MIN = 5 * 60;        // 05:00
const SERVICE_END_MIN   = 23 * 60 + 59;  // 23:59
const DAY = 24 * 60;

//시:분 -> 분 으로 변환
  function timeToMinutes(timeStr) {
    const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
    const h = Number.isFinite(hh) ? hh : 0;
    const m = Number.isFinite(mm) ? mm : 0;
    return h * 60 + m;
  }

  // 분 -> 시:분 문자열로 변경
  function minutesToTime(minutes){
    // 24시간 롤오버 및 음수 보정
    minutes = ((minutes % DAY) + DAY) % DAY;
    const hh = String(Math.floor(minutes/60)).padStart(2, '0');
    const mm = String(minutes%60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // ✅ “시:분”이 서비스 윈도우 안에 있는지 확인
  function isWithinServiceHHMM(hhmm) {
    const m = timeToMinutes(hhmm);
    return m >= SERVICE_START_MIN && m <= SERVICE_END_MIN;
  }

  // ✅ “분”값(정수)이 서비스 윈도우 안에 있는지 확인
  function isWithinServiceMin(mins) {
    mins = ((mins % DAY) + DAY) % DAY;
    return mins >= SERVICE_START_MIN && mins <= SERVICE_END_MIN;
  }


  //출발시간 구할 때 시간 뺄셈 함수
  function subtractMinutesFromTime(baseTime, minutesToSubtract) {
     const total = timeToMinutes(baseTime) - minutesToSubtract;
    // 음수/롤오버는 minutesToTime이 알아서 처리
    return minutesToTime(total);
  }

  //도착 시간 구할 때 시간 덧셈 함수
  function addMinutesToTime(baseTime, minutesToAdd) {
    const [h, m] = baseTime.split(':').map(Number);
    const total = h * 60 + m + minutesToAdd;
    return minutesToTime(total); // 24h 롤오버/음수 보정 일관화
  }

  // === 별칭 제공: 다른 파일에서 toMin/toTime으로도 사용 가능하게 ===
  const toMin  = timeToMinutes;
  const toTime = minutesToTime;

  module.exports = {
  timeToMinutes,
  minutesToTime,
  isWithinServiceHHMM,
  isWithinServiceMin,
  subtractMinutesFromTime,
  addMinutesToTime,
  SERVICE_START_MIN,
  SERVICE_END_MIN,
  DAY,
  // 별칭(새 로직에서 사용)
  toMin,
  toTime,
};
