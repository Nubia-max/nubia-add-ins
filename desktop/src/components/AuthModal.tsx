import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    console.log('Starting authentication...', { isLogin, email });

    try {
      let result;
      if (isLogin) {
        console.log('Attempting login...');
        result = await login(email, password);
        console.log('Login successful:', result);
      } else {
        console.log('Attempting registration...');
        result = await register(email, password);
        console.log('Registration successful:', result);
      }
      
      setLoading(false);
      onSuccess(result.user);
      onClose();
    } catch (error) {
      console.error('Authentication error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div className="nubia-logo-container">
            <svg
              width="80"
              height="80"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="nubia-logo"
            >
              <path
                d="M16 2L4 8V16C4 23.5 8.5 26.74 16 28C23.5 26.74 28 23.5 28 16V8L16 2Z"
                fill="url(#authGradient)"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 10V16L20 20"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="authGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333ea" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="nubia-title">Nubia</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={8}
            />
            {!isLogin && (
              <small className="password-hint">
                Password must be at least 8 characters with uppercase, lowercase, and number
              </small>
            )}
          </div>

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={toggleMode} className="toggle-link">
              {isLogin ? 'Create Account' : 'Login'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};

export default AuthModal;