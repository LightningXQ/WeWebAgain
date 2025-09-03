// ✅ 서비스 시간대 상수 추가
const SERVICE_START_MIN = 5 * 60;        // 05:00
const SERVICE_END_MIN   = 23 * 60 + 59;  // 23:59


//시:분 -> 분 으로 변환
  function timeToMinutes(timeStr) {
    const [hh, mm] = timeStr.split(":").map(Number);
    return hh * 60 + mm;
  }

  // 분 -> 시:분 문자열로 변경
  function minutesToTime(minutes){
    // 24시간 롤오버 및 음수 보정
    minutes = ((minutes % (24*60)) + (24*60)) % (24*60);
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
    mins = ((mins % (24*60)) + (24*60)) % (24*60);
    return mins >= SERVICE_START_MIN && mins <= SERVICE_END_MIN;
  }


  //출발시간 구할 때 시간 뺄셈 함수
  function subtractMinutesFromTime(baseTime, minutesToSubtract) {
    const [h, m] = baseTime.split(':').map(Number);
    let total = h * 60 + m - minutesToSubtract;
    if (total < 0) total += 24 * 60;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  //도착 시간 구할 때 시간 덧셈 함수
  function addMinutesToTime(baseTime, minutesToAdd) {
    const [h, m] = baseTime.split(':').map(Number);
    const total = h * 60 + m + minutesToAdd;
    return minutesToTime(total); // 24h 롤오버/음수 보정 일관화
  }

  module.exports = {
  timeToMinutes,
  minutesToTime,
  isWithinServiceHHMM,
  isWithinServiceMin,
  subtractMinutesFromTime,
  addMinutesToTime,
  SERVICE_START_MIN,
  SERVICE_END_MIN,
};
