import { Box } from '@mui/material';
import { styled } from '@mui/system';

const GradientBackground = styled(Box)(({ cover }) => ({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
  minHeight: '100vh',
  backgroundImage: `
    linear-gradient(
      to bottom,
      rgba(237,237,237,1.0) 40%,
      rgba(237,237,237,0.0) 90%
    ),
    url(${cover})
  `,
  backgroundRepeat: "no-repeat",
  backgroundSize: "cover",
}));

export default GradientBackground;
