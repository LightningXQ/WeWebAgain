// React
import React, { useState } from 'react';

// axios
// eslint-disable-next-line
import axios from "axios";

// Material-UI
import {
  Typography,
  TextField,
  Card,
  CardContent,
  Box,
  Stack,
} from '@mui/material';
import { 
	createTheme, 
	ThemeProvider, 
} from '@mui/material/styles';

// Modules
import GradientBackground from '../common/gradient-background';
import GradientButton from '../common/gradient-button';
import CustomAppBar from '../common/custom-app-bar';

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

	const handleSearch = async () => {
		try {
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
				<Typography 
					position="fixed" 
					top="120px" 
					variant='h4' 
					color="#666666" 
					mb={2} 
					textAlign="center"
				>
					{ 
						mode 
							? "finding a minimum waiting time..."
							: ""
					}
				</Typography>
				<Card sx={{ 
					width: 600, 
					height: 550, 
					borderRadius: 8, 
					boxShadow: 20,
					position: 'relative',  // 상대 위치 설정
					overflow: 'visible',   // 그라데이션이 밖으로 나가도록
					border: "1.5px solid #3644C9",
				}}>
					{/* 상단 그라데이션 */}
					<Box sx={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						height: 40,  // 그라데이션 높이
						background: 'linear-gradient(to top, #2A8CFF 0%, #3068E4 29%, #3644C9 58%)',
						borderTopLeftRadius: "28px",
						borderTopRightRadius: "28px",
					}} />

					{/* 컨텐츠 */}
					<CardContent sx={{ 
						height: "100%", 
						padding: 10, 
						boxSizing: 'border-box',
						position: 'relative',  // 컨텐츠가 그라데이션 위에 보이도록
						zIndex: 1,
					}}>
						<Typography variant='h5' fontWeight="bold" mb={2}>Location</Typography>

						<Stack spacing={2} mb={5}>
							<TextField fullWidth placeholder='출발지를 입력하세요.' />
							<TextField fullWidth placeholder='도착지를 입력하세요.' />
						</Stack>

						<Typography variant='h5' fontWeight="bold" mb={2}>ETA</Typography>

						<Stack direction="row" spacing={2} mb={5} alignItems="center">
							<TextField placeholder='도착 예정 시간' inputProps={{ sx: { textAlign: 'center' } }} />
							<Typography variant='h5' fontWeight="bold">:</Typography>
							<TextField placeholder='도착 예정 시간' inputProps={{ sx: { textAlign: 'center' } }} />
						</Stack>

						<GradientButton onClick={handleSearch} sx={{
							display: "block",
							marginLeft: "auto",
							marginRight: "auto",
							width: "80%",
							height: 56,
						}}>Searching</GradientButton>
					</CardContent>
				</Card>
			</GradientBackground>
		</ThemeProvider>
	)
}

export default Mainpage;
