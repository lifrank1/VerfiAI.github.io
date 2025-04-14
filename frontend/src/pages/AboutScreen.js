import React from "react";
import { Link } from "react-router-dom";
import NavigationHeader from "../components/NavigationHeader";
import "../styles/AboutScreen.css";

const FeatureItem = ({ title, description }) => {
  return (
    <div className="feature-item">
      <div className="arrow-icon">▶</div>
      <div className="feature-content">
        <h3 className="feature-title">{title}</h3>
        <p className="feature-description">{description}</p>
      </div>
    </div>
  );
};

const AboutScreen = () => {
  return (
    <div className="about-page">
      <NavigationHeader />
      
      <div className="about-container">
        <div className="about-header">
          <div className="logo-container">
            <h1 className="logo-text">V<span className="dot">.</span>ai</h1>
          </div>
          <div className="header-text">
            <h1 className="main-title">Your AI-Powered Citation Verification Tool</h1>
            <p className="subtitle">Built to uphold academic integrity with speed, accuracy, and transparency</p>
          </div>
        </div>

        <div className="button-container">
          <Link to="/chat">
            <button className="try-button">TRY VERIFAI</button>
          </Link>
        </div>

        <div className="features-container">
          <FeatureItem 
            title="Free & Open-Source" 
            description="VerifAI is accessible to everyone" 
          />
          
          <FeatureItem 
            title="AI-Generated citation Identification" 
            description="Identifies citations that may be hallucinated by AI models" 
          />
          
          <FeatureItem 
            title="Retracted Paper Detection" 
            description="Flags references that have been formally retracted" 
          />
          
          <FeatureItem 
            title="Condensed Source Suggestion" 
            description="Recommends compact sources when multiple references are similar" 
          />
          
          <FeatureItem 
            title="Academic Integrity Support" 
            description="A comprehensive tool for students, researchers, and journal editors" 
          />
        </div>
      </div>
    </div>
  );
};

export default AboutScreen; 