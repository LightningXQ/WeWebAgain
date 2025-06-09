import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

const WeatherContainer = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    // backgroundColor: '#f5f5f5',
    // borderRadius: '12px',
    // boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
    maxWidth: '400px',
    margin: '0 auto',
});

const ForecastContainer = styled(Box)({
    display: 'flex',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '16px',
});
    
const ForecastItem = styled(Box)({
    flex: '1 1 1',
    padding: '12px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    textAlign: 'center',
});

const Icon = styled('img')({
    width: 70,
    height: 70,
    marginRight: '16px',
});

const TempText = styled(Typography)({
    fontSize: '30px',
    fontWeight: 'bold',
    color: '#000000', // 원하는 온도 색상
});

const DescriptionText = styled(Typography)({
    fontSize: '20px',
    color: '#333',
});

function Weather() {
    const cityName = 'busan';
    const key = '70ef1fee480976c84b714a4d5f10ece2';
    const [apiValue, setApiValue] = useState(null);
    const [secondApiValue, setSecondApiValue] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const getWeather = async () => {
            try {
                const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${key}&units=metric&lang=KR`);
                const result = await response.json();
                setApiValue(result);
                console.log('current weather api: ', result);
            } catch (error) {
                console.error("날씨 데이터를 불러오는 데 실패했습니다:", error);
            }
        };
        getWeather();
    }, []); // 빈 배열 → 컴포넌트가 처음 렌더링될 때만 실행

    useEffect(() => {
        const getFutureWeather = async () => {
            try {
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&appid=${key}&units=metric&lang=KR`
                );
                const result = await response.json();
    
                const today = new Date();
                const targetDates = [];
    
                // 3일치 날짜 문자열 배열 생성
                for (let i = 1; i <= 3; i++) {
                    const date = new Date(today);
                    date.setDate(date.getDate() + i);
                    targetDates.push(date.toISOString().slice(0, 10));
                }
    
                // 대상 날짜의 모든 시간대 데이터 필터링(최고, 최저 온도를 고르기 위해)
                const data = result.list.filter(item => {
                    const dateOnly = item.dt_txt.slice(0, 10);
                    return targetDates.includes(dateOnly);
                });
    
                console.log("*** 00시부터 포함된 날별 전체 데이터 ***", data);
    
                // 날짜별 그룹화
                const dateMap = {};
                data.forEach(item => {
                    const date = item.dt_txt.slice(0, 10);
                    if (!dateMap[date]) {
                        dateMap[date] = [];
                    }
                    dateMap[date].push(item);
                });
    
                // 날짜별 최고/최저 기온 요약
                const summary = Object.entries(dateMap).map(([date, items]) => {
                    const temps = items.map(i => i.main);
                    return {
                        date,
                        min: Math.min(...temps.map(t => t.temp_min)),
                        max: Math.max(...temps.map(t => t.temp_max)),
                        icon: items[0].weather[0].icon,
                        description: items[0].weather[0].description,
                    };
                });
    
                console.log("*** 정리된 일별 최고/최저 데이터 ***", summary);
    
                setSecondApiValue(summary);
                setLoading(false);
            } catch (error) {
                console.error("날씨 데이터를 불러오는 데 실패했습니다:", error);
            }
        };
    
        getFutureWeather();
    }, []);

    return (
        <div>
            {loading || !apiValue || !secondApiValue ? (
                <Typography align="center">날씨 정보를 불러오는 중...</Typography>
            ) : (
                <>
                    <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                            paddingTop: 2,
                            paddingLeft: 4,
                        }}
                    >
                        날씨
                    </Typography>
                    
                    {/* 현재 날씨 */}
                    <WeatherContainer>
                        <Icon
                            src={`https://openweathermap.org/img/wn/${apiValue.weather[0].icon}.png`}
                            alt="weather icon"
                        />
                        <Box>
                            <TempText>{apiValue.main.temp.toFixed(1)}°C</TempText>
                            <DescriptionText>{apiValue.weather[0].description}</DescriptionText>
                        </Box>
                    </WeatherContainer>
    
                    {/* 미래 날씨 예보 */}
                    <ForecastContainer>
                        
                        {secondApiValue.map((item) => (
                            <ForecastItem key={item.date}>
                                <Typography variant="h6">{item.date.slice(5)}</Typography>
                                <img
                                    src={`https://openweathermap.org/img/wn/${item.icon}.png`}
                                    alt="forecast icon"
                                />
                                <Typography>{item.description}</Typography>
                                <Typography>
                                    <span style={{ color: 'red' }}>{item.min.toFixed(0)}°C</span> / <span style={{ color: '#4597F7' }}>{item.max.toFixed(0)}°C</span>
                                </Typography>
                            </ForecastItem>
                        ))}
                    </ForecastContainer>

                    <Typography variant="body2" align="center" sx={{ mt: 2, fontStyle: 'italic' }}>
                        <span style={{ color: 'red' }}>최저</span> / <span style={{ color: '#4597F7' }}>최고</span>
                    </Typography>
                </>
            )}
        </div>
    );    
}

export default Weather;
