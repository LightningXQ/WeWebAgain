import { Button } from '@mui/material';
import { styled } from '@mui/system';

const GradientButton = styled(Button)({
  background: `linear-gradient(to right, #3068E4, #AFDDFF)`,
  color: 'white',
  fontWeight: 'bold',
  marginTop: '16px',
  boxShadow: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
  '&:hover': {
    background: 'linear-gradient(to right, #00f2fe, #4facfe)',
    boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)'
  },
  '&:active': {
    boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)'
  },
  borderRadius: 40,
  fontSize: 24,
  textTransform: 'none',
});

export default GradientButton;
