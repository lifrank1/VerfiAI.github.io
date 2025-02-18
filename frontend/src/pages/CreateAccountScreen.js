import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginScreen.css';

function CreateAccount() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordMismatchError, setPasswordMismatchError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    if (password !== confirmPassword) {
      setPasswordMismatchError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3002/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('User created:', data);
        navigate('/');
      } else {
        setError(data.message || 'Failed to create account');
        setIsSubmitting(false);
      }
    } catch (error) {
      setError('Error: ' + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-section">
        <h2>Create an Account</h2>
        {error && <p className="error-message">{error}</p>}
        {passwordMismatchError && <p className="error-message">{passwordMismatchError}</p>}
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
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field"
            required
          />
          <button 
            type="submit" 
            className="login-button" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <button 
          className="back-button" 
          onClick={() => navigate('/')} 
          disabled={isSubmitting}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

export default CreateAccount;