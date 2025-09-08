import Cookies from 'js-cookie';
import { User } from '@/types';

const TOKEN_KEY = 'xeno_token';
const USER_KEY = 'xeno_user';

export const authService = {
  setToken: (token: string) => {
    Cookies.set(TOKEN_KEY, token, { expires: 7 }); // 7 days
  },

  getToken: (): string | undefined => {
    return Cookies.get(TOKEN_KEY);
  },

  setUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },

  logout: () => {
    Cookies.remove(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!authService.getToken();
  },

  getAuthHeaders: () => {
    const token = authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  // Helper to get user ID for API calls
  getUserId: (): number | null => {
    const user = authService.getUser();
    return user ? user.UserId : null;
  }
};
