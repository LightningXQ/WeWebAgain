// React
import React, { useState } from 'react';

// axios
// eslint-disable-next-line
import axios from "axios";

// Material-UI
import {
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  Link,
  Card,
  CardContent,
  Box,
  Stack,
  Divider,
} from '@mui/material';
import { 
	createTheme, 
	ThemeProvider, 
} from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

// Modules
import GradientBackground from '../common/gradient-background';
import GradientButton from '../common/gradient-button';
import CustomAppBar from '../common/custom-app-bar';

// Declaration
const logo = "/images/logo.png";
const cover = "/images/login_background.png";
const naver = "/images/logo_naver.png";
const kakaotalk = "/images/logo_kakaotalk.png";

const theme = createTheme({});

const Login = () => {
	const [userId, setUserId] = useState('');
	const [password, setPassword] = useState('');
	const [keepLogin, setKeepLogin] = useState(true);

	const handleLogin = async () => {
		try {
			const response = await axios.post('http://localhost:4000/login', {
				userId,
				password,
				keepLogin,
			});
			console.log(response.data);
			console.log(userId, password, keepLogin);
			return;
		} catch (error) {
			console.error(error);
			return;
		}
	};
	
	return (
		<ThemeProvider theme={theme}>
			{/* 전체 화면 배경 */}
			<GradientBackground cover={cover}>
				{/* 상단 네비게이션 바 */}
				<CustomAppBar logo={logo} />

				{/* 배경과 로그인 카드 */}
				<Card sx={{ 
					width: 550, 
					height: 700, 
					borderRadius: 8, 
					boxShadow: 20, 
				}}>
					<CardContent sx={{ 
						height: "100%", 
						padding: 10, 
						boxSizing: 'border-box', 
					}}>
						<Typography variant="h4" align="center" fontWeight="bold" mb={6}>로그인</Typography>

						<Stack spacing={2} mb={2}>
							<TextField 
								label="아이디" 
								variant="outlined" 
								fullWidth 
								value={userId}
								onChange={event => setUserId(event.target.value)}
								sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'black' } }} 
							/>
							<TextField 
								label="비밀번호" 
								variant="outlined" 
								fullWidth 
								type="password" 
								value={password}
								onChange={event => setPassword(event.target.value)}
								sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'black' } }} 
							/>
						</Stack>

						<FormControlLabel control=
							{<Checkbox 
								checked={keepLogin}
								onChange={event => setKeepLogin(event.target.checked)}
								icon={<RadioButtonUncheckedIcon sx={{ color: '#4BE04B', fontSize: 20 }} />}
								checkedIcon={<CheckCircleIcon sx={{ color: '#4BE04B', fontSize: 20 }} />}
								sx={{ '& .MuiSvgIcon-root': { borderRadius: '50%' } }}
							/>} 
							label="로그인 상태 유지" 
						/>

						<Box textAlign="right" mb={6}>
							<Link href="/login" underline="hover" fontSize="small">
								비밀번호 변경
							</Link>
						</Box>

						<GradientButton variant="contained" fullWidth onClick={handleLogin} sx={{
							display: "block",
							marginLeft: "auto",
							marginRight: "auto",
							width: "80%",
							height: 56,
						}}>
							Log In
						</GradientButton>

						<Divider sx={{ 
							my: 3, 
							"&::before, &::after": {
								borderColor: "black",
							}, 
						}}>SNS 로그인</Divider>
						<Stack direction="row" spacing={2} justifyContent="center">
							<Button>
								<img src={naver} alt="Logo" style={{ width: 56, height: 56 }} />
							</Button>
							<Button>
								<img src={kakaotalk} alt="Logo" style={{ width: 56, height: 56 }} />
							</Button>
						</Stack>
					</CardContent>
				</Card>
			</GradientBackground>
		</ThemeProvider>
	)
}

export default Login;
