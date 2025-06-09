import React, { useState, useEffect } from 'react';
import { 
	AppBar, 
	Toolbar, 
	Typography, 
	IconButton, 
	Box, 
	Stack, 
	Button,
  Dialog,
  DialogTitle,
  TextField,
  Icon
} from '@mui/material';
import AccountBoxIcon from '@mui/icons-material/AccountBox';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';

import GradientButton from '../common/gradient-button';

import axios from "axios";

const logo = "/images/logo.png";

const AppBarButton = (props) => (
  <Button
		{...props}
    sx={{
			fontSize: '20px',
			fontWeight: "bold",
			borderRadius: '40px',
			textTransform: 'none',
			...props.sx
		}}
  >
    {props.children}
  </Button>
);

const CustomAppBar = ({ isLogin }) => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

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
        if (response.data.loggedIn) {
          setUserId(response.data.user.id);
          setNickname(response.data.user.username);
          setEmail(response.data.user.email);
        }
				return;
			} catch (error) {
				console.error(error);
				return;
			}
		};

		getUserInfo();
	}, []);

  const handleLogout = async () => {
    try {
      const response = await axios.get("http://localhost:4000/auth/logout",
        {
					withCredentials: true,
					headers: {
						'Content-Type': 'application/json'
					}
				}
      );
      console.log(response);
      window.location.reload();
      navigate('/');
    } catch (error) {
      console.error(error);
      return;
    }
  }

  return (
    <>
      <AppBar position="fixed" color="transparent" elevation={0} sx={{
        height: 80,
        backgroundColor: "#F8F8F8",
        justifyContent: "center",
        zIndex: (theme) => theme.zIndex.drawer + 1,
        borderBottom: "1.5px solid #AAAAAA"
      }}>
        <Toolbar sx={{ 
          justifyContent: "space-between",
          height: "100%"
        }}>
          <IconButton color="inherit" edge="start" aria-label="logo" sx={{ zIndex: 1 }} onClick={() => navigate('/')}>
            <img src={logo} alt="Logo" style={{ width: 56, height: 56 }} />
          </IconButton>

          <Box sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: "center",
            alignItems: "center",
            zIndex: 0,
            pointerEvents: 'none',
          }}>
            <Typography variant="h4" fontWeight="bold" sx={{
              pointerEvents: 'auto',
              background: 'linear-gradient(90deg, #60B5FF 0%, #666666 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'inline-block',
            }}>
              Transfer Master
            </Typography>
          </Box>

          <Stack direction="row" spacing={3} sx={{ zIndex: 1 }}>
            <IconButton size="large" onClick={() => navigate('/')}>
              <HomeIcon color="primary" size="large"></HomeIcon>
            </IconButton>
            {isLogin 
              ? 
              <AppBarButton variant="contained" size="large" sx={{ 
                backgroundColor: "white", 
                border: "1.5px solid #45EB59",
                px: 4 
              }} onClick={() => setOpen(true)}>
                <span style={{
                  color: "black",
                  fontWeight: "normal"
                }}>안녕하세요,&nbsp;</span>
                <span style={{
                  color: "#45EB59",
                  fontWeight: "normal"
                }}>
                  {nickname}
                </span>
                <span style={{
                  color: "black",
                  fontWeight: "normal"
                }}>
                  님!
                </span>
              </AppBarButton>
              :
              <>
                <AppBarButton color="inherit" variant="text" size="large" onClick={() => navigate('/signup')}>회원가입</AppBarButton>
                <AppBarButton variant="contained" size="large" sx={{ backgroundColor: "#3644C9", px: 4 }} onClick={() => navigate('/login')}>로그인</AppBarButton>
              </>
            }
          </Stack>
        </Toolbar>
      </AppBar>
      <Dialog open={open} onClose={() => setOpen(false)}
				PaperProps={{
					sx: {
            margin: 0,
            position: "absolute",
						width: 370, 
						height: 200, 
            top: 60, 
            right: 0, 
						backgroundColor: 'transparent', 
						boxShadow: "none", 
					}
				}}
				BackdropProps={{
					sx: {
						backgroundColor: 'rgba(0, 0, 0, 0)', // 원하는 색상과 투명도로 변경
					}
				}}
			>
        <Box sx={{
          margin: "auto",
          padding: 2,
          backgroundColor: "white", 
          width: 300, 
          height: 160, 
          boxSizing: "border-box", 
          border: "none",
          borderRadius: 4,
          boxShadow: 8, 
        }}>
          <Stack direction="column" sx={{
            height: "100%"
          }}>
            <Stack direction="row" spacing={1}>
              <Icon sx={{
                width: 80,
                height: 80,
              }}>
                <AccountBoxIcon sx={{
                  width: 80,
                  height: 80,
                }}></AccountBoxIcon>
              </Icon>
              <Box>
                <Typography fontWeight={500} fontSize={24}>
                  {nickname}
                </Typography>
                <Typography fontSize={12} color="gray">
                  {userId}
                </Typography>
                <Typography fontSize={12} color="gray">
                  {email}
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <Stack alignItems="flex-end">
              <Button onClick={handleLogout} sx={{
                border: "1.5px solid red",
                borderRadius: 12,
                color: "red",
                position: "relative",
                right: 0,
                bottom: 0,
                width: 120,
                height: 36,
              }}>
                로그아웃
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>
    </>
  );
}

export default CustomAppBar;