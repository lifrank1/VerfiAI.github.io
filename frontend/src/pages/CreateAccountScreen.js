import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginScreen.css'; 
import NavigationHeader from '../components/NavigationHeader';

function CreateAccount() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Added confirm password state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [passwordMismatchError, setPasswordMismatchError] = useState(''); // Error for password mismatch
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if passwords match
    if (password !== confirmPassword) {
      setPasswordMismatchError("Passwords do not match.");
      return; // Prevent form submission if passwords don't match
    }

    try {
      const response = await fetch('http://localhost:3002/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('User created:', data);
        navigate('/');  // Redirect to home screen
      } else {
        setError(data.message || 'Failed to create account');
      }
    } catch (error) {
      setError('Error: ' + error.message);
    }
  };

  return (
    
    <div className="login-page-container">
      <NavigationHeader />
      <div className="login-section">
        <h2>Create an Account</h2>
        {error && <p className="error-message">{error}</p>}
        {passwordMismatchError && <p className="error-message">{passwordMismatchError}</p>} {/* Display password mismatch error */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="password"
            placeholder="Confirm Password" // Added confirm password input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field"
            required
          />
          <button type="submit" className="login-button">
            Create Account
          </button>
        </form>
        <button className="back-button" onClick={() => navigate('/')}>
          Go Back
        </button>
      </div>
    </div>
  );
}

export default CreateAccount;
