import Mainpage from './component/mainpage/mainpage.js';
import Login from './component/login/login.js';
import Signin from './component/signin/signin.js';

import { BrowserRouter, Route, Routes } from "react-router-dom";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Mainpage />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signin' element={<Signin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
