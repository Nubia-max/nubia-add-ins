import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User, AuthState, LoginCredentials, RegisterCredentials } from '../types';
import { storageService } from '../services/storage';
import { apiService } from '../services/api';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  bypassAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_USER' };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return { 
        ...state, 
        user: action.payload, 
        isAuthenticated: true, 
        isLoading: false 
      };
    case 'CLEAR_USER':
      return { 
        user: null, 
        isAuthenticated: false, 
        isLoading: false 
      };
    default:
      return state;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    isLoading: true
  });

  useEffect(() => {
    // Check for existing auth token and validate
    const checkAuth = async () => {
      try {
        const token = await storageService.getAuthToken();
        const userData = await storageService.getUserData();
        
        if (token && userData) {
          // Validate token with backend
          try {
            const validatedUser = await apiService.verifyToken();
            dispatch({ type: 'SET_USER', payload: validatedUser });
          } catch (error) {
            console.warn('Token validation failed, clearing stored auth:', error);
            await storageService.clearAuthToken();
            await storageService.clearUserData();
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    
    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { user, token } = await apiService.login(credentials);
      await storageService.setAuthToken(token);
      await storageService.setUserData(user);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { user, token } = await apiService.register(credentials);
      await storageService.setAuthToken(token);
      await storageService.setUserData(user);
      dispatch({ type: 'SET_USER', payload: user });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  const logout = async () => {
    await storageService.clearAuthToken();
    await storageService.clearUserData();
    dispatch({ type: 'CLEAR_USER' });
  };

  const bypassAuth = async () => {
    try {
      await storageService.setMockData();
      const userData = await storageService.getUserData();
      if (userData) {
        dispatch({ type: 'SET_USER', payload: userData });
      }
    } catch (error) {
      console.error('Bypass auth failed:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      bypassAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};