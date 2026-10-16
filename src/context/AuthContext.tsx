import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, LoginRequest } from '../types';
import { apiService, subscribeSessionExpired } from '../services/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'AUTH_READY' }
  | { type: 'UPDATE_USER'; payload: User };

interface AuthContextType {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  updateProfile: (updates: { 
    full_name: string; 
    email: string; 
    zone?: string;
    brands?: string[];
    specialty?: string;
    rating?: number;
    password?: string 
  }) => Promise<void>;
}

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAILURE':
      return { ...state, isLoading: false, isAuthenticated: false, user: null };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false, isLoading: false };
    case 'AUTH_READY':
      return { ...state, isLoading: false };
    case 'UPDATE_USER':
      return { ...state, user: action.payload };
    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => subscribeSessionExpired(() => {
    dispatch({ type: 'LOGOUT' });
  }), []);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      dispatch({ type: 'AUTH_READY' });
      return;
    }

    apiService.setToken(token);
    let cancelled = false;

    apiService.getProfile()
      .then((response) => {
        if (cancelled) return;
        if (response.success && response.data) {
          localStorage.setItem('user', JSON.stringify(response.data));
          dispatch({ type: 'LOGIN_SUCCESS', payload: response.data });
          return;
        }
        apiService.clearToken();
        dispatch({ type: 'AUTH_READY' });
      })
      .catch(() => {
        if (cancelled) return;
        if (!apiService.getToken()) {
          dispatch({ type: 'LOGOUT' });
          return;
        }
        try {
          const user = JSON.parse(userData) as User;
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        } catch {
          apiService.clearToken();
          dispatch({ type: 'AUTH_READY' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      const credentials: LoginRequest = { username, password };
      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: response.data.user });
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE' });
      throw error;
    }
  };

  const logout = () => {
    apiService.clearToken();
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  const updateProfile = async (updates: { 
    full_name: string; 
    email: string; 
    zone?: string;
    brands?: string[];
    specialty?: string;
    rating?: number;
    password?: string 
  }) => {
    if (!state.user) throw new Error('No user logged in');
    const response = await apiService.updateProfile(updates);
    if (response.success && response.data) {
      updateUser(response.data);
    } else {
      throw new Error(response.error || 'Failed to update profile');
    }
  };

  const value: AuthContextType = {
    state,
    login,
    logout,
    updateUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 