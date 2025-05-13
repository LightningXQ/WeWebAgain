/* global naver */
import { useState, useEffect } from 'react';

let mapInstance = null;

const loadScript = (src, callback) => {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = src;
  script.onload = () => callback();
  document.head.appendChild(script);
};

function NaverMap({
  latitude = 0,
  longitude = 0,
}) {
  // 지도 로딩 상태
  const [isMapLoaded, setMapLoaded] = useState(false);

  const initMap = () => {
    // 추가 옵션 설정
    const mapOptions = {
      zoomControl: true,
      zoomControlOptions: {
        style: naver.maps.ZoomControlStyle.SMALL,
        position: naver.maps.Position.TOP_RIGHT,
      },
      center: new naver.maps.LatLng(latitude, longitude),
      zoom: 16,
    };

    // 지도 초기화 확인
    if (document.getElementById('map')) {
      mapInstance = new naver.maps.Map('map', mapOptions);
    }

    // Marker 생성
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(latitude, longitude),
      map: mapInstance,
    });

    // Marker 클릭 시 지도 초기화
    naver.maps.Event.addListener(marker, 'click', () => {
      mapInstance?.setCenter(new naver.maps.LatLng(latitude, longitude));
      mapInstance?.setZoom(16);
    });

    // 지도 로드 완료
    setMapLoaded(true);
  };

  useEffect(() => {
    // 스크립트 로딩 확인
    if (typeof naver === 'undefined') {
      loadScript(
        'https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=726xm0gokn',
        () => {
          // DOM이 준비된 후 지도 초기화
          setTimeout(initMap, 100);
        }
      );
    } else {
      // DOM이 준비된 후 지도 초기화
      setTimeout(initMap, 100);
    }
  }, [latitude, longitude]);

  return (
    <>
      {/* 위치 정보(지도) */}
      <div className="mb-8 mt-40 flex w-screen flex-col items-center">
        <span className="sm:text-md font-Pretendard text-sm font-bold text-[#06439F] md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">
          위치 안내
        </span>
        {isMapLoaded && (
          <div id="map" style={{width: "100%", height: "400px"}}/>
        )}
      </div>
    </>
  );
}

export default NaverMap;
