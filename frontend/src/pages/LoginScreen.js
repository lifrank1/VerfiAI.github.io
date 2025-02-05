import React, { useState } from 'react';
import { firebaseApp } from '../firebase-config';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import '../styles/LoginScreen.css';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const auth = getAuth(firebaseApp);
    
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('Logged in successfully', userCredential);
        // Redirect to the home screen or dashboard after login
      })
      .catch((error) => {
        setError(error.message);
      });
  };

  return (
    <div className="login-page-container">
      <div className="login-section">
        <h1 className="app-name">VerifAI</h1>
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            className="input-field"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input-field"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="login-button">Log In</button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
