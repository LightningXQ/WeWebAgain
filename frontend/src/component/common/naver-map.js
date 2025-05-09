import React, { useEffect, useRef } from 'react';

const NaverMap = () => {
  const mapElement = useRef(null);

  useEffect(() => {
    if (window.naver && mapElement.current) {
      const mapOptions = {
        center: new window.naver.maps.LatLng(37.5665, 126.9780), // 서울시청 좌표
        zoom: 15,
      };
      // 지도 생성
      new window.naver.maps.Map(mapElement.current, mapOptions);
    }
  }, []);

  return (
    <div
      ref={mapElement}
      style={{ width: '100%', height: '400px' }}
    />
  );
}

export default NaverMap;
