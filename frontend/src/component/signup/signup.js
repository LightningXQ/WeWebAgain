// React
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

const theme = createTheme({});

const Signup = () => {
	const navigate = useNavigate();

	const [userId, setUserId] = useState('');
	const [idError, setIdError] = useState(null);
	const [nickname, setNickname] = useState('');
	const [password, setPassword] = useState('');
	const [passwordError, setPasswordError] = useState(null);
	const [emailAddress, setEmailAddress] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
	const [open, setOpen] = useState(false);
	
	const [selected, setSelected] = useState('버스');

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

	const handleSignup = async () => {
		try {
			if (idError === null) {
				alert("아이디 중복 검사 필요");
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
			setOpen(true);
			return;
		} catch (error) {
			console.error(error);
			return;
		}
	}

	const submitSignup = () => {
		try {
			// const response = await axios.post('http://localhost:4000/login', {
			// 	userId,
			// 	nickname,
			// 	password,
			// 	emailAddress,
			// 	emailDomain,
			// 	selected, 
			// });
			// console.log(response.data);
			console.log(userId, nickname, password, `${emailAddress}@${emailDomain}`, selected);
			setOpen(false);
			navigate('/signup/complete');
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
					height: 760, 
					transform: "translate(0, 5%)",
					borderRadius: 8, 
					boxShadow: 20, 
				}}>
					<CardContent sx={{ 
						height: "100%", 
						padding: 10, 
						paddingTop: 6,
						boxSizing: 'border-box', 
					}}>
						<Box>
							<Typography variant="h4" align="center" fontWeight="bold" mb={5}>회원가입</Typography>
						</Box>
						<Box>
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
						</Box>
						<Box>
							{/* Sign-up */}
							<GradientButton variant="contained" fullWidth onClick={handleSignup} sx={{
								display: "block",
								marginLeft: "auto",
								marginRight: "auto",
								width: "80%",
								height: 56,
							}}>
								Sign Up
							</GradientButton>

						</Box>

					</CardContent>
				</Card>
			</GradientBackground>
			
			{/* 모달 */}
			<Dialog open={open} onClose={() => setOpen(false)} 
				PaperProps={{
					sx: {
						width: 600, 
						height: 300, 
						backgroundColor: 'transparent',
						boxShadow: "none", 
					}
				}}
				BackdropProps={{
					sx: {
						backgroundColor: 'rgba(0, 0, 0, 0.2)', // 원하는 색상과 투명도로 변경
					}
				}}
			>
				<Box sx={{
					backgroundColor: "white", 
					width: 600, 
					height: 250, 
					paddingX: 8, 
					paddingY: 4, 
					boxSizing: "border-box", 
					border: "2px solid #3068E4",
					borderRadius: 4,
				}}>
					<DialogTitle textAlign="center" sx={{ p: 0, mb: 2 }}>어떤 대중교통을 선호하나요?</DialogTitle>
					<Divider sx={{ 
						bgcolor: "black",
					}} />
					<DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden' }}>
						<Stack direction="row">
							<Button
								variant="text"
								sx={{
									width: "50%",
									fontWeight: selected === '지하철' ? 'bold' : 'normal',
									color: selected === '지하철' ? '#2A8CFF' : 'black',
									backgroundColor: selected === '지하철' ? '#EBF4F6' : 'transparent',
									fontSize: 24,
									py: 3,
									borderRadius: 0,
								}}
								onClick={() => setSelected('지하철')}
							>
								지하철
							</Button>
							<Button
								variant="text"
								sx={{
									width: "50%",
									fontWeight: selected === '버스' ? 'bold' : 'normal',
									color: selected === '버스' ? '#2A8CFF' : 'black',
									backgroundColor: selected === '버스' ? '#EBF4F6' : 'transparent',
									fontSize: 24,
									py: 3,
									borderRadius: 0,
								}}
								onClick={() => setSelected('버스')}
							>
								버스
							</Button>
						</Stack>
					</DialogContent>
				</Box>
				<DialogActions>
					<GradientButton onClick={submitSignup} sx={{
						display: "block",
						marginLeft: "auto",
						marginRight: "auto",
						width: "60%",
						height: 56,
					}}>Submit</GradientButton>
				</DialogActions>
			</Dialog>
		</ThemeProvider>
	)
}

export default Signup;
