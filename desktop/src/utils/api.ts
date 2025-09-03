import axios from 'axios';
import { User, LoginCredentials, RegisterCredentials } from '../types';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nubia-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nubia-token');
      // Redirect to login or refresh the app
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async register(credentials: RegisterCredentials): Promise<{ user: User; token: string }> {
    const { confirmPassword, ...registerData } = credentials;
    const response = await api.post('/auth/register', registerData);
    return response.data;
  },

  async validateToken(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

export const chatService = {
  async getHistory(userId: string) {
    const response = await api.get(`/chat/history/${userId}`);
    return response.data;
  },

  async sendMessage(message: any) {
    const response = await api.post('/chat/send', message);
    return response.data;
  }
};

export const automationService = {
  async executeTask(task: string, mode: 'visual' | 'background') {
    const AUTOMATION_URL = process.env.REACT_APP_AUTOMATION_URL || 'http://localhost:8000';
    const response = await axios.post(`${AUTOMATION_URL}/execute`, { task, mode });
    return response.data;
  },

  async getTaskStatus(taskId: string) {
    const AUTOMATION_URL = process.env.REACT_APP_AUTOMATION_URL || 'http://localhost:8000';
    const response = await axios.get(`${AUTOMATION_URL}/status/${taskId}`);
    return response.data;
  },

  async abortTask(taskId: string) {
    const AUTOMATION_URL = process.env.REACT_APP_AUTOMATION_URL || 'http://localhost:8000';
    const response = await axios.post(`${AUTOMATION_URL}/abort/${taskId}`);
    return response.data;
  }
};

export default api;