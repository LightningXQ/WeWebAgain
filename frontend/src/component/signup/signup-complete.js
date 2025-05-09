// React
import React from 'react';
import { useNavigate } from 'react-router-dom';

// Material-UI
import {
  Card, 
	CardContent,
	Typography, 
	Stack, 
} from '@mui/material';
import { 
	createTheme, 
	ThemeProvider 
} from '@mui/material/styles';

// Modules
import GradientBackground from '../common/gradient-background';
import GradientButton from '../common/gradient-button';
import CustomAppBar from '../common/custom-app-bar';

// Declaration
const logo = "/images/logo.png";
const cover = "/images/login_background.png";
const check = "/images/logo_check.png";

const theme = createTheme({});

const SignupComplete = () => {
	const navigate = useNavigate();

	return (
		<ThemeProvider theme={theme}>
			{/* 전체 화면 배경 */}
			<GradientBackground cover={cover}>
				{/* 상단 네비게이션 바 */}
				<CustomAppBar logo={logo} />
				<Card sx={{ 
					width: 550, 
					height: 700, 
					borderRadius: 8, 
					boxShadow: 20, 
				}}>
					<CardContent sx={{ 
						height: "100%", 
						paddingX: 4, 
						paddingTop: 20, 
						boxSizing: 'border-box', 

						display: "flex",
						flexDirection: "column", 
						alignItems: "center", 
					}}>
						<img src={check} alt="Logo" style={{ width: 100, height: 100, marginBottom: 4 }} />

						<Stack alignItems="center" my={6} spacing={1}>
							<Typography variant='h4'>회원가입이 완료되었습니다.</Typography>
							<Typography fontSize={18} color="#666666">환승마스터와 함께 효율적인 경로를 찾아봐요!</Typography>
						</Stack>

						<GradientButton onClick={() => navigate("/login")} sx={{
							display: "block",
							marginLeft: "auto",
							marginRight: "auto",
							marginTop: "60px",
							width: "80%",
							height: 56,
						}}>Back to Login</GradientButton>
					</CardContent>
				</Card>
			</GradientBackground>
		</ThemeProvider>
	)
}

export default SignupComplete;
