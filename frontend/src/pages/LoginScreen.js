import React, { useState } from "react";
import { Link } from "react-router-dom";
import { firebaseApp } from "../firebase-config";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom"; // Importing useNavigate for routing
import NavigationHeader from "../components/NavigationHeader";
import "../styles/LoginScreen.css";
import { useAuth } from "../contexts/authContext";


const LoginScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate(); // Initialize navigate

  const handleLogin = (e) => {
    e.preventDefault();
    const auth = getAuth(firebaseApp);

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log("Logged in successfully", userCredential);
        const userID = userCredential.user.uid; 
        login(userID);
        navigate("/chat"); // Redirect to chat page after successful login
      })
      .catch((error) => {
        console.error("Full Firebase Error:", error); // Print full error object
        console.error("Firebase Error Code:", error.code); // Print error code specifically

        // Map Firebase error codes to user-friendly messages
        const errorMessages = {
          "auth/invalid-credential": "Invalid email or password.",
          "auth/user-disabled":
            "This account has been disabled. Contact support.",
          "auth/user-not-found":
            "No account found with this email. Please sign up.",
          "auth/too-many-requests":
            "Too many failed attempts. Try again later.",
          "auth/network-request-failed":
            "Network error. Check your connection.",
        };

        // Check if error.code is undefined or not matching
        if (!error.code) {
          console.error("Error Code is Undefined:", error);
        }

        // Set error message or return default
        const errorMessage =
          errorMessages[error.code] || `Unexpected error: ${error.message}`;
        setError(errorMessage);
      });
  };

  const handleBack = () => {
    navigate(-1); // Navigate back to the previous page
  };

  return (
    <div className="login-page-container">
      <NavigationHeader />
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
          <button type="submit" className="login-button">
            Log In
          </button>
        </form>
        <div className="create-account-link">
          <p>
            Don't have an account? <Link to="/create-account">Create one</Link>
          </p>
        </div>
        <button onClick={handleBack} className="back-button">
          Back to Home
        </button>{" "}
        {/* Back button */}
      </div>
    </div>
  );
};

export default LoginScreen;
