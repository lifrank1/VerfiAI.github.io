// CreateAccountScreen.js
import React, { useState } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseApp, db } from '../firebase-config';
import { useNavigate } from 'react-router-dom';
import { setDoc, doc } from 'firebase/firestore'; // Firestore methods
import '../styles/LoginScreen.css';

const CreateAccountScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const navigate = useNavigate(); // Hook to navigate after account creation

  const handleCreateAccount = (e) => {
    e.preventDefault();

    // Check if passwords match
    if (password !== verifyPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    const auth = getAuth(firebaseApp);

    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        console.log('Account created successfully', userCredential);

        // After account creation, store the additional user information in Firestore
        const userId = userCredential.user.uid; // Get the user's unique ID

        try {
          // Save the user data to Firestore under 'users' collection
          await setDoc(doc(db, 'users', userId), {
            firstName,
            lastName,
            email,
            createdAt: new Date(), // You can also store when the account was created
          });

          // After saving user data, redirect to home screen
          navigate('/');
        } catch (firestoreError) {
          setError('Error saving user data: ' + firestoreError.message);
        }
      })
      .catch((error) => {
        setError(error.message); // Display any errors during account creation
      });
  };

  return (
    <div className="login-page-container">
      <div className="login-section">
        <h1 className="app-name">VerifAI</h1>
        <form onSubmit={handleCreateAccount} className="login-form">
          <input
            type="text"
            className="input-field"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            type="text"
            className="input-field"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
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
          <input
            type="password"
            className="input-field"
            placeholder="Verify Password"
            value={verifyPassword}
            onChange={(e) => setVerifyPassword(e.target.value)}
            required
          />
          {error && <p className="error-message">{error}</p>}
          {passwordError && <p className="error-message">{passwordError}</p>}
          <button type="submit" className="login-button">Create Account</button>
        </form>
      </div>
    </div>
  );
};

export default CreateAccountScreen;
