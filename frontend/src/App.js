import Mainpage from './component/mainpage/mainpage.js';
import Login from './component/login/login.js';
import Signup from './component/signup/signup.js';
import SignupComplete from './component/signup/signup-complete.js';
import TestPage from './component/temp/test-page.js';

import { BrowserRouter, Route, Routes } from "react-router-dom";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Mainpage />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/signup/complete' element={<SignupComplete />} />
        <Route path='/test' element={<TestPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
