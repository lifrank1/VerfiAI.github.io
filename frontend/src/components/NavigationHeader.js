// NavigationHeader.js
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/authContext"; // Import the custom hook
import "../styles/HomeScreen.css"; 
import logo from "../assets/verifaiLogo.png"; 

const NavigationHeader = () => {
  const { isLoggedIn, login, logout } = useAuth();

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
        <div className="login-button-container">
          {isLoggedIn ? (
            <Link to ="/">
            <button className="login-button" onClick={logout}>
              Log Out
            </button>
            </Link>
          ) : (
            <Link to="/LoginScreen">
              <button className="login-button">Log In</button>
            </Link>
          )}
        </div>
        {!isLoggedIn && (
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
