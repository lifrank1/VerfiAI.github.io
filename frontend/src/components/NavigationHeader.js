// NavigationHeader.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authContext"; // Import the custom hook
import "../styles/HomeScreen.css"; 
import logo from "../assets/verifaiLogo.png"; 
import { getAuth, signOut } from 'firebase/auth';
import { firebaseApp } from '../firebase-config';

const NavigationHeader = () => {
  const { isLoggedIn, login, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const auth = getAuth(firebaseApp);
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <header className="nav-header">
      <div className="nav-container">
        <div className="logo">
          <Link to="/">
            <img src={logo} alt="Logo" className="logo-img" />
          </Link>
        </div>
        <nav className="nav-links">
          <Link to="/about">About</Link>
          <Link to="/features">Features</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </div>
      <div className="nav-buttons">
        {isLoggedIn ? (
          <button className="login-button" onClick={handleLogout}>
            Log Out
          </button>
        ) : (
          <div className="create-account-button-container">
            <Link to="/create-account">
              <button className="create-account-button">Create Account</button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavigationHeader;
