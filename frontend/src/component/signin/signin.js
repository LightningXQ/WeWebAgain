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
  Card,
  CardContent,
  Box,
	Autocomplete, 
	Dialog, 
	DialogTitle, 
	DialogContent, 
	DialogActions, 
	Divider, 
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

const theme = createTheme({});

const Signin = () => {
	const [userId, setUserId] = useState('');
	const [idError, setIdError] = useState(null);
	const [nickname, setNickname] = useState('');
	const [password, setPassword] = useState('');
	const [passwordError, setPasswordError] = useState(null);
	const [emailAddress, setEmailAddress] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
	const [open, setOpen] = useState(false);

	const emailDomains = ["naver.com", "gmail.com", "daum.net"];

	const verifyUserId = async () => {
		try {
			// const response = await axios.post('http://localhost:4000/login', {
			// 	userId, 
			// });
			// console.log(response.data);
			if (userId.length >= 2) setIdError(false);
			else setIdError(true);
			return;
		} catch (error) {
			console.error(error);
		}
	}

	const verifyPassword = (pw) => {
		const regexp = new RegExp("^[A-Za-z0-9]{8,}$");
		if (regexp.test(pw)) setPasswordError(false);
		else setPasswordError(true);
		return;
	}

	const handleSignin = async () => {
		try {
			if (idError === null) {
				alert("아이디 중복 검사 필요");
				setOpen(true);
				return;
			}
			if (idError === true) {
				alert("유효하지 않은 아이디");
				return;
			}
			if (nickname.length === 0) {
				alert("닉네임 입력 필요");
				return;
			}
			if (passwordError === null) {
				alert("비밀번호 입력 필요");
				return;
			}
			if (passwordError === true) {
				alert("유효하지 않은 비밀번호");
				return;
			}
			// const response = await axios.post('http://localhost:4000/login', {
			// 	userId,
			// 	nickname,
			// 	password,
			// 	emailAddress,
			// 	emailDomain,
			// });
			// console.log(response.data);
			console.log(userId, nickname, password, `${emailAddress}@${emailDomain}`);
			setOpen(true);
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
						<Typography variant="h4" align="center" fontWeight="bold" mb={4}>회원가입</Typography>

						{/* ID */}
						<Typography fontWeight="bold" mb={.25}>ID</Typography>
						<Box display="flex" mb={4}>
							<TextField
								variant="standard" 
								fullWidth
								placeholder="아이디를 입력하세요."
								value={userId}
								onChange={event => {
									setUserId(event.target.value);
									setIdError(null);
								}}
								error={idError}
								helperText={
									idError === null
										? ""
										: idError === true
											? "사용할 수 없는 아이디입니다."
											: "사용 가능한 아이디입니다."
								}
								slotProps={{
									formHelperText: { sx: {
										color: idError === false ? 'green' : undefined
									} }
								}}
							/>
							<Button variant="contained"	size="small" onClick={verifyUserId} sx={{ 
								width: 100, 
								height: 32, 
								ml: 2, 
								bgcolor: "#2A8CFF", 
								fontSize: 12, 
								whiteSpace: 'nowrap', 
								boxSizing: "border-box", 
								borderRadius: 2.5, 
							}}>
								중복 확인
							</Button>
						</Box>

						{/* Nickname */}
						<Typography fontWeight="bold" mb={.25}>NICKNAME</Typography>
						<TextField 
							variant="standard" 
							fullWidth 
							placeholder="사용할 닉네임을 입력하세요." 
							value={nickname}
							onChange={event => setNickname(event.target.value)}
							sx={{	mb: 4 }} 
						/>

						{/* Password */}
						<Typography fontWeight="bold" mb={.25}>PASSWORD</Typography>
						<TextField
							variant="standard" 
							fullWidth 
							placeholder="비밀번호를 입력하세요. (영문, 숫자 포함 8자리 이상)"
							type="password"
							value={password}
							onChange={event => {
								setPassword(event.target.value);
								verifyPassword(event.target.value);
							}}
							error={passwordError}
							sx={{ mb: 4 }} 
							helperText={
								passwordError === null
									? ""
									: passwordError === true
										? "조건에 맞지 않는 비밀번호입니다."
										: "조건에 맞는 비밀번호입니다."
							}
							slotProps={{
								formHelperText: { sx: {
									color: passwordError === false ? 'green' : undefined
								} }
							}}
						/>

						{/* Email */}
						<Typography fontWeight="bold" mb={.25}>E-MAIL</Typography>
						<Box display="flex" alignItems="center" mb={6}>
							<TextField
								variant="standard"
								fullWidth
								placeholder="이메일을 입력하세요."
								value={emailAddress}
								onChange={(event) => setEmailAddress(event.target.value)}
								sx={{ flex: 2 }}
							/>
							<Typography mx={2} fontSize={20}>@</Typography>
							<Autocomplete
								options={emailDomains}
								value={emailDomain}
								onChange={(_, newValue) => setEmailDomain(newValue || "")}
								onInputChange={(_, newInputValue) => setEmailDomain(newInputValue)}
								renderInput={(params) => (
									<TextField
										{...params}
										variant="standard"
										placeholder="직접 입력"
										sx={{ flex: 2, minWidth: 120 }}
									/>
								)}
								disableClearable
							/>
						</Box>
						
						{/* Sign-up */}
						<GradientButton variant="contained" fullWidth onClick={handleSignin} sx={{
							display: "block",
							marginLeft: "auto",
							marginRight: "auto",
							width: "80%",
							height: 56,
						}}>
							Sign In
						</GradientButton>
					</CardContent>
				</Card>
			</GradientBackground>
			
			{/* 모달 */}
			<Dialog open={open} onClose={() => setOpen(false)} PaperProps={{
				sx: {
					width: 500,
					height: 250,
					backgroundColor: 'transparent',
				}
			}}>
				<Box sx={{
					backgroundColor: "white", 
					width: 500,
					height: 200, 
					padding: 4, 
					boxSizing: "border-box", 
					border: "2px solid #3068E4",
					borderRadius: 4,
				}}>
					<DialogTitle textAlign="center" sx={{ p: 0, mb: 2 }}>어떤 대중교통을 선호하나요?</DialogTitle>
					<Divider sx={{ 
						bgcolor: "black",
						mb: 2,
					}} />
					<DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden' }}>
						modalMessage
					</DialogContent>
				</Box>
				<DialogActions>
					<Button onClick={() => setOpen(false)}>확인</Button>
				</DialogActions>
			</Dialog>
		</ThemeProvider>
	)
}

export default Signin;
