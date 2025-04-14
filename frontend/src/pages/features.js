import React from 'react';
import '../styles/features.css';

const Features = () => {
  return (
    <div className="features-container">
      <div className="about-header">
        <h1>About <span className="v-logo">V</span><span className="ai-logo">.ai</span></h1>
      </div>

      <div className="mission-section">
        <h2>Our Mission</h2>
        <p>An open-source effort to preserve the truth in academic writing</p>
        <div className="divider-dot"></div>
      </div>

      <div className="values-section">
        <h2>Our Values</h2>
        <p>promoting transparency, fighting misinformation, and empowering academia with AI.</p>
      </div>

      <div className="help-section">
        <h2>We help</h2>
        
        <div className="help-cards">
          <div className="help-card">
            <h3>Graduate Students</h3>
            <p>Easily verify and format citations to ensure accuracy for thesis completion.</p>
          </div>

          <div className="help-card">
            <h3>Academic researchers</h3>
            <p>Quickly check for adherence to journal-specific citation guidelines before submission.</p>
          </div>

          <div className="help-card">
            <h3>Professors/ Instructors</h3>
            <p>Streamline the process of verifying citations and flagging AI-generated sources in student work.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;
