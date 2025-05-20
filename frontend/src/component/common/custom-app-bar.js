import React from 'react';
import { 
	AppBar, 
	Toolbar, 
	Typography, 
	IconButton, 
	Box, 
	Stack, 
	Button 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';

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

  return (
    <AppBar position="fixed" color="transparent" elevation={0} sx={{
      height: 80,
      backgroundColor: "white",
      justifyContent: "center",
      zIndex: (theme) => theme.zIndex.drawer + 1,
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
          <AppBarButton color="inherit" variant="text" size="large" onClick={() => navigate('/signup')}>회원가입</AppBarButton>
          {/* <AppBarButton color="inherit" variant="text" size="large" onClick={() => navigate('/test')}>test</AppBarButton> */}
          {isLogin ?
            <AppBarButton variant="contained" size="large" sx={{ backgroundColor: "#3644C9", px: 4 }} onClick={() => navigate('/login')}>로그아웃</AppBarButton>
            :
            <AppBarButton variant="contained" size="large" sx={{ backgroundColor: "#3644C9", px: 4 }} onClick={() => navigate('/login')}>로그인</AppBarButton>
          }
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

export default CustomAppBar;