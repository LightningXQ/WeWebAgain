// React
import { useEffect, useState } from 'react';

// axios
// eslint-disable-next-line
import axios from "axios";

// Material-UI
import {
	Autocomplete,
	Box,
	Card,
	Stack,
	TextField,
	Typography
} from '@mui/material';
import {
	createTheme,
	ThemeProvider,
} from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import { DesktopTimePicker } from '@mui/x-date-pickers/DesktopTimePicker';

// Modules
import CustomAppBar from '../common/custom-app-bar';
import GradientBackground from '../common/gradient-background';
import GradientButton from '../common/gradient-button';
import NaverMap from '../common/naver-map';
import Weather from '../common/weather';

// Declaration
const logo = "/images/logo.png";
const cover = "/images/login_background.png";
const weather = "/images/weather_example.png";
const food = "/images/food.png";

const theme = createTheme({
	components: {
		MuiOutlinedInput: {
			styleOverrides: {
				root: {
					fontSize: 20,
					borderRadius: 20,
					' .MuiOutlinedInput-notchedOutline': {
						borderColor: '#AAAAAA',
						borderWidth: 2,
					},
					':hover .MuiOutlinedInput-notchedOutline': {
						borderColor: '#AAAAAA',
						borderWidth: 2,
					},
					'&.Mui-focused': {
						backgroundColor: '#EBF4F6',
					},
					'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
						borderColor: '#60B5FF',
					},
				},
			},
		},
	},
});

const Mainpage = () => {
	const [mode, setMode] = useState(false);
	const [startLocation, setStartLocation] = useState("");
	const [endLocation, setEndLocation] = useState("");
	const [arrivalTime, setArrivalTime] = useState(null);
	const [arrivalDate, setArrivalDate] = useState(null);
	const [startLocationSearchResult, setStartLocationSearchResult] = useState([]);
	const [endLocationSearchResult, setEndLocationSearchResult] = useState([]);
	const [startCoords, setStartCoords] = useState(null);
	const [endCoords, setEndCoords] = useState(null);

	const handleSearch = () => {
		console.log(startLocation, endLocation, arrivalDate, arrivalDate);
		return;
	}

	useEffect(() => {
		const getUserInfo = async () => {
			try {
				const response = await axios.get('http://localhost:4000/auth/check',
					{
						withCredentials: true,
						headers: {
							'Content-Type': 'application/json'
						}
					});
				console.log(response.data);
				setMode(response.data.loggedIn);
				return;
			} catch (error) {
				console.error(error);
				return;
			}
		};

		getUserInfo();
	}, []);

	useEffect(() => {
		const startLocationSearch = async () => {
			try {
				const response = await axios.get(
					"https://apis.openapi.sk.com/tmap/pois",
					{
						params: {
							version: "1",
							format: "json",
							searchKeyword: startLocation,
							resCoordType: "EPSG3857",
							reqCoordType: "WGS84GEO",
							count: 10,
						},
						headers: {
							appKey: "WhGcxVojKO7g0CL8lD1NYgw2TiEf2r25qFNDUpOd",
						},
					}
				);

				/** POI 이름만 추출해서 한 번에 state 교체 */
				const names = [
					...new Set(
						response.data.searchPoiInfo.pois.poi.map((poi => poi.name))
					),
				];
				setStartLocationSearchResult(names);           // 문자열 배열이어도 고유성 확보, ✅ 단일 setState

				console.log(startLocation);
				console.log(response.data);
				console.log(startLocationSearchResult);

				return;
			} catch (error) {
				console.log(error);
				return;
			}
		}

		startLocationSearch();
	}, [startLocation]);

	useEffect(() => {
		const endLocationSearch = async () => {
			try {
				const response = await axios.get(
					"https://apis.openapi.sk.com/tmap/pois",
					{
						params: {
							version: "1",
							format: "json",
							searchKeyword: endLocation,
							resCoordType: "EPSG3857",
							reqCoordType: "WGS84GEO",
							count: 10,
						},
						headers: {
							appKey: "WhGcxVojKO7g0CL8lD1NYgw2TiEf2r25qFNDUpOd",
						},
					}
				);

				/** POI 이름만 추출해서 한 번에 state 교체 */
				const names = [
					...new Set(
						response.data.searchPoiInfo.pois.poi.map((poi => poi.name))
					),
				];
				setEndLocationSearchResult(names);           // 문자열 배열이어도 고유성 확보, ✅ 단일 setState

				console.log(endLocation);
				console.log(endLocationSearchResult);

				return;
			} catch (error) {
				console.log(error);
				return;
			}
		}

		endLocationSearch();
	}, [endLocation]);

	useEffect(() => {
		const apiTest1 = async () => {
			try {
				let responseList = [];
				for (let number = 1; number < 10; number++) {
					const BASE_URL =
					"https://apis.data.go.kr/1613000/BusRoutespecificStopInformation/getBusRoutespecificStopInformation";
				
					const response = await axios.get(BASE_URL, {
						/* 쿼리 파라미터는 params 객체로 깔끔하게 관리 */
						params: {
							serviceKey:
								"EvKLpvREUknBQwnfnB+FTdLwm6XJvZ3qLZuP8TuJO9DNrdO1iooes0295IrgsNO9Rcia4ahjp2yx8fyhhvuUbg==",
							pageNo: number,
							numOfRows: 1,
							opr_ymd: "20250405", // 운영연월일
							ctpv_cd: 26,         // 광역시·도 코드
							sgg_cd: 26380,       // 시·군·구 코드
							dataType: "JSON",
						},
						headers: {
							accept: "*/*",
						},
					});

					console.log(response.data);

					for (let i = 0; i < 10; i++) {
						responseList.push(response.data.Response.body.items.item[i])
					}
				}

				console.log(responseList);
				return;
			} catch (error) {
				console.log(error);
				return;
			}
		}
		apiTest1();
	}, [])

	useEffect(() => {
		const apiTest2 = async () => {
			try {
				const BASE_URL = "https://api.odsay.com/v1/api/searchPubTransPathT/";
			
				const response = await axios.post(BASE_URL, {
					/* 쿼리 파라미터는 params 객체로 깔끔하게 관리 */
					params: {
						apiKey:
							"EvKLpvREUknBQwnfnB+FTdLwm6XJvZ3qLZuP8TuJO9DNrdO1iooes0295IrgsNO9Rcia4ahjp2yx8fyhhvuUbg==",
						SX: 129.105518,
						SY: 35.134626,
						EX: 128.946189,
						EY: 35.171906,
						OPT: 0,
						SearchType: 0,
						SearchPathType: 0, // 운영연월일
						lang: 0,         // 광역시·도 코드
						output: "json",       // 시·군·구 코드
					},
					headers: {
						accept: "*/*",
					},
				});
				console.log(response.data);

				return;
			} catch (error) {
				console.log(error);
				return;
			}
		}

		apiTest2();
	}, []);

	return (
		<ThemeProvider theme={theme}>
			{/* 전체 화면 배경 */}
			<GradientBackground cover={cover}>
				{/* 상단 네비게이션 바 */}
				<CustomAppBar isLogin={mode} />
				<Box sx={{
					flex: 1,
					display: "flex",
					flexDirection: "row",

					width: "100%",
					marginTop: 10,
				}}>
					<Box sx={{
						flex: 2.8,
						backgroundColor: "#F8F8F8",
						padding: 4,
						borderRight: "1.5px solid #AAAAAA"
					}}>
						<Box my={2}>
							<Typography fontSize={24} mb={2} fontWeight="bold">
								위치 설정
							</Typography>
							<Autocomplete
								freeSolo
								options={startLocationSearchResult}
								renderInput={(params) => <TextField {...params} fullWidth placeholder="출발지를 입력하세요." value={startLocation} onChange={(e) => setStartLocation(e.target.value)} sx={{marginBottom: 2}} />}
							>
							</Autocomplete>
							<Autocomplete
								freeSolo
								options={endLocationSearchResult}
								renderInput={(params) => <TextField {...params} fullWidth placeholder="도착지를 입력하세요." value={endLocation} onChange={(e) => setEndLocation(e.target.value)} sx={{ marginBottom: 6 }} />}
							>
							</Autocomplete>
							<Typography fontSize={24} mb={2} fontWeight="bold" sx={{
							}}>
								도착 예정 시간 설정
							</Typography>
							<LocalizationProvider dateAdapter={AdapterDayjs}>
								<Stack direction="row" spacing={2} sx={{
									justifyContent: "space-evenly",
								}}>
									<DesktopDatePicker label="날짜 선택" value={arrivalDate} onChange={(newValue) => setArrivalDate(newValue)} sx={{ width: 200, }} />
									<DesktopTimePicker label="시간 선택" value={arrivalTime} onChange={(newValue) => setArrivalTime(newValue)} sx={{ width: 200, }} />
								</Stack>
							</LocalizationProvider>
							<GradientButton variant="contained" onClick={handleSearch} sx={{
								marginTop: 4,
								borderRadius: 8,
								paddingX: 4,
								paddingY: 1.5,
								width: "100%"
							}}
							>
								설정 완료
							</GradientButton>
						</Box>
					</Box>
					<Stack direction="row" spacing={4} sx={{
						flex: 7,
						'& > *': {  // Stack의 모든 직계 자식 요소에 적용
							flex: 1,
							minWidth: 0  // flex item이 부모 컨테이너를 넘어가지 않도록 함
						},
						margin: 4,
					}}>
						<Card sx={{
							borderRadius: 8,
							border: "1.5px solid #3644C9"
						}}>
							<NaverMap />
						</Card>
						<Stack direction="column" spacing={4} sx={{
							'& > *': {  // Stack의 모든 직계 자식 요소에 적용
								flex: 1,
								minWidth: 0  // flex item이 부모 컨테이너를 넘어가지 않도록 함
							},
							margin: 4,
						}}>
							<Card sx={{
								borderRadius: 8,
								border: "1.5px solid #AAAAAA",
							}}>
								<Weather />
							</Card>
							<Card sx={{
								borderRadius: 8,
								display: "flex",
								border: "1.5px solid gray",
							}}>
								{/* <img src={food} style={{ width: "543px", height: "382px" }}></img> */}
							</Card>
						</Stack>
					</Stack>
				</Box>
			</GradientBackground>
		</ThemeProvider>
	)
}

export default Mainpage;
