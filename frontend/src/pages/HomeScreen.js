import React from 'react';
import '../styles/HomeScreen.css'; // Import the CSS file

const HomeScreen = () => {
  return (
    <div className="hero-section">
      <div className="container text-center">
        <h1 className="app-name">VerifAI</h1>
        <p className="tagline">
          Verify references, detect AI-generated content, and ensure academic integrity.
        </p>
        <button className="login-button">Log In</button>
      </div>
    </div>
  );
};

export default HomeScreen;