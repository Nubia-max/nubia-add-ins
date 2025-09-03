import React, { useState } from 'react';

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: any) => void;
  onBypassAuth?: () => void;
}

const NubiaLogo: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg 
    className={className}
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="authLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
      </linearGradient>
    </defs>
    <path 
      d="M8 6h3l8 12V6h3v20h-3l-8-12v12H8V6z" 
      fill="url(#authLogoGradient)"
    />
    <circle 
      cx="25" 
      cy="9" 
      r="2" 
      fill="rgba(255,255,255,0.8)"
    />
  </svg>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onBypassAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const validateForm = (): string | null => {
    if (!formData.email || !formData.password) {
      return 'Please fill in all required fields';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Replace with actual API call
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `${isLogin ? 'Login' : 'Registration'} failed`);
      }

      // Store token and user data
      if (window.electronStore) {
        await window.electronStore.set('authToken', data.token);
        await window.electronStore.set('userData', data.user);
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBypass = () => {
    if (onBypassAuth) {
      // Create mock user data for testing
      const mockUser = {
        id: 'mock-user-id',
        email: 'test@nubia.ai',
        settings: {
          automationMode: 'visual',
          notifications: true,
          autoMinimize: false
        }
      };
      const mockToken = 'mock-jwt-token';
      
      if (window.electronStore) {
        window.electronStore.set('authToken', mockToken);
        window.electronStore.set('userData', mockUser);
      }
      
      onBypassAuth();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-nubia flex items-center justify-center p-8">
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white/5 to-transparent rounded-full animate-pulse-slow" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-white/5 to-transparent rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-4 backdrop-blur-sm border border-white/20">
            <NubiaLogo className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Nubia</h1>
          <p className="text-white/80 text-sm">Your AI-powered Excel automation assistant</p>
        </div>

        {/* Auth form */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-8 shadow-xl">
          <div className="mb-6">
            <div className="flex rounded-lg bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  isLogin 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  !isLogin 
                    ? 'bg-white text-purple-600 shadow-sm' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-100 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-white/80 text-sm font-medium mb-1">
                Email address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200"
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-white/80 text-sm font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200"
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            {!isLogin && (
              <div>
                <label htmlFor="confirmPassword" className="block text-white/80 text-sm font-medium mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-200"
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-purple-600 hover:bg-white/90 py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Bypass option for testing */}
          {onBypassAuth && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <button
                onClick={handleBypass}
                className="w-full text-white/60 hover:text-white/80 text-sm py-2 transition-colors duration-200"
                disabled={isLoading}
              >
                Continue without authentication (Testing Mode)
              </button>
            </div>
          )}

          {isLogin && (
            <div className="mt-4 text-center">
              <a 
                href="#" 
                className="text-white/60 hover:text-white/80 text-sm transition-colors duration-200"
                onClick={(e) => e.preventDefault()}
              >
                Forgot your password?
              </a>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-white/60 text-xs">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
};