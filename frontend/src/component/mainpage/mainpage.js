// React
import React, { useState } from 'react';

// axios
// eslint-disable-next-line

// Material-UI
import {
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

// Declaration
const logo = "/images/logo.png";
const cover = "/images/login_background.png";

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

	const handleSearch = async () => {
		try {
			console.log("출발지:", startLocation);
			console.log("도착지:", endLocation);
			console.log("도착 날짜:", arrivalDate?.format("YYYY-MM-DD"));
			console.log("도착 시간:", arrivalTime?.format("HH:mm"));

			setMode(!mode);
			return;
		} catch (error) {
			console.error(error);
			return;
		}
	}
	
	return (
		<ThemeProvider theme={theme}>
			{/* 전체 화면 배경 */}
			<GradientBackground cover={cover}>
				{/* 상단 네비게이션 바 */}
				<CustomAppBar logo={logo} />
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
					}}>
						<Box my={2}>
							<Typography fontSize={24} mb={2} fontWeight="bold" sx={{
							}}>
								위치 설정
							</Typography>
							<TextField fullWidth placeholder="출발지를 입력하세요." value={startLocation} onChange={(e) => setStartLocation(e.target.value)} sx={{
								marginBottom: 2,
							}} />
							<TextField fullWidth placeholder="도착지를 입력하세요." value={endLocation} onChange={(e) => setEndLocation(e.target.value)} sx={{
								marginBottom: 6,
							}} />
							<Typography fontSize={24} mb={2} fontWeight="bold" sx={{
							}}>
								도착 예정 시간 설정
							</Typography>
							<LocalizationProvider dateAdapter={AdapterDayjs}>
								<Stack direction="row" spacing={2} sx={{
									justifyContent: "space-evenly",
								}}>
									<DesktopDatePicker label="날짜 선택" value={arrivalDate} onChange={(newValue) => setArrivalDate(newValue)} sx={{ width: 200, }}/>
									<DesktopTimePicker label="시간 선택" value={arrivalTime} onChange={(newValue) => setArrivalTime(newValue)} sx={{ width: 200, }}/>
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
							}}>
								fff
							</Card>
							<Card sx={{
							}}>
								fff
							</Card>
						</Stack>
					</Stack>
				</Box>
			</GradientBackground>
		</ThemeProvider>
	)
}

export default Mainpage;
