/* global naver */
import { useEffect, useRef, useState } from 'react';

// Material-UI
import {
  Box
} from '@mui/material';


let mapInstance = null;

// 외부 스크립트 로드 함수
const loadScript = (src, callback) => {
  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    existingScript.remove(); // 기존 스크립트 제거 (이전 키 방지)
  }

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = src;
  script.onload = () => callback();
  document.head.appendChild(script);
};

function NaverMap() {
  const [isMapLoaded, setMapLoaded] = useState(false);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const mapRef = useRef(null);

  // 지도 초기화 함수
  const initMap = () => {
    if (latitude === null || longitude === null) return;

    const mapOptions = {
      center: new naver.maps.LatLng(latitude, longitude),
      zoom: 16,
      zoomControl: true,
      zoomControlOptions: {
        style: naver.maps.ZoomControlStyle.SMALL,
        position: naver.maps.Position.TOP_RIGHT,
      },
    };

    if (!mapRef.current) {
      setTimeout(initMap, 100);
      return;
    }

    mapInstance = new naver.maps.Map(mapRef.current, mapOptions);

    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(latitude, longitude),
      map: mapInstance,
    });

    naver.maps.Event.addListener(marker, 'click', () => {
      mapInstance?.setCenter(new naver.maps.LatLng(latitude, longitude));
      mapInstance?.setZoom(16);
    });

    setMapLoaded(true);
  };

  // 위치 정보 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
        },
        (error) => {
          console.error("위치 정보를 가져오는 데 실패했습니다.", error);
          // fallback 좌표
          setLatitude(37.3595704);
          setLongitude(127.105399);
        }
      );
    } else {
      console.warn("Geolocation을 지원하지 않는 브라우저입니다.");
      setLatitude(37.3595704);
      setLongitude(127.105399);
    }
  }, []);

  // 스크립트 로드 및 지도 초기화
  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      if (typeof naver === 'undefined') {
        loadScript(
          'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=xxjxzgrbgq',
          initMap
        );
      } else {
        initMap();
      }
    }
  }, [latitude, longitude]);

  return (
    <Box style={{ height: "100%" }}>
      <div ref={mapRef} style={{ height: "100%" }}>
        {!isMapLoaded && <p>지도를 불러오는 중입니다...</p>}
      </div>
    </Box>
  );
}

export default NaverMap;
