import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../styles/HomeScreen.css";
import logo from '../assets/verifaiLogo.png';


const NavigationHeader = () => {
  return (
    <header className="nav-header">
      <div className="nav-container">
        <div className="logo">
          <Link to="/">
            <img src={logo} alt="Logo" className="logo-img" />
          </Link>
        </div>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/features">Features</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </div>
      <div className="nav-buttons">
        <div className="login-button-container">
          <Link to="/LoginScreen">
            <button className="login-button">Log In</button> 
          </Link>
        </div>
        <div className="create-account-button-container">
          <Link to="/create-account">
            <button className="create-account-button">Create Account</button>
          </Link>
        </div>
      </div>
    </header>
  );
};




const WordAnimation = () => {
  const [activeWord, setActiveWord] = useState(0);
  const [previousWord, setPreviousWord] = useState(null);
  const words = ['Upload', 'Check', 'Refine'];

  useEffect(() => {
    const interval = setInterval(() => {
      setPreviousWord(activeWord);
      setActiveWord((prev) => (prev + 1) % words.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [words.length, activeWord]);

  return (
    <div className="word-container">
      {words.map((word, index) => (
        <div
          key={word}
          className={`animated-word ${activeWord === index ? 'active' : ''} ${previousWord === index ? 'exit' : ''}`}
        >
          {word}
        </div>
      ))}
    </div>
  );
};

const HomeScreen = () => {
  const scrollToNextSection = () => {
    const ideaSection = document.querySelector('.idea-section');
    ideaSection.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="page-container">
      <NavigationHeader />
      <div className="hero-section">
        <div className="container text-center">
          <h1 className="app-name">VerifAI</h1>
          <p className="tagline">
            <span className="highlight-word">Verify</span>references, 
            <span className="highlight-word">detect</span>AI-generated content, and 
            <span className="highlight-word">ensure</span>academic integrity.
          </p>
          <Link to="/LoginScreen">
            <button className="login-button">Log In</button>
          </Link>
          <div className="scroll-indicator" onClick={scrollToNextSection}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" fill="#6E44FF"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="section idea-section">
        <div className="vision-content">
          <div className="vision-text">
            <h2>Our Vision</h2>
            <p>
              Our AI agent will be able to look at a paper's references and tell whether or not the paper actually used those references, and verify any information that came from that reference. Additionally, it will determine whether the source is real, AI hallucinated, or retracted.
            </p>
          </div>
          <div className="vision-image">
            <WordAnimation />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
