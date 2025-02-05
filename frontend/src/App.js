import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomeScreen from './pages/HomeScreen';
import LoginScreen from './pages/LoginScreen';
import CreateAccountScreen from './pages/CreateAccountScreen';  

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/LoginScreen" element={<LoginScreen />} />
        <Route path="/create-account" element={<CreateAccountScreen />} />  
      </Routes>
    </Router>
  );
}

export default App;
