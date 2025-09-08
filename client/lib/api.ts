import axios from 'axios';
import { authService } from './auth';
import { AuthResponse, BookUploadResponse, Book } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Authentication
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/api/users/login', { Email: username, Password: password });
    return response.data;
  },

  register: async (username: string, password: string, email?: string, phone?: string): Promise<AuthResponse> => {
    const response = await api.post('/api/users/signup', { 
      UserName: username, 
      Password: password, 
      Email: email || `${username}@example.com`,
      Phone: phone || undefined
    });
    return response.data;
  },

  // Books
  uploadBook: async (
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<BookUploadResponse> => {
    const formData = new FormData();
    formData.append('pdfFile', file);

    const response = await api.post('/api/books/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  getBooks: async (page = 1, limit = 10): Promise<{ books: Book[]; pagination: any }> => {
    const response = await api.get(`/api/books?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  deleteBook: async (bookId: number): Promise<void> => {
    await api.delete(`/api/books/${bookId}`);
  },

  getBookPages: async (bookId: number) => {
    const response = await api.get(`/api/books/${bookId}/pages`);
    return response.data.data;
  },

  getBookDetails: async (bookId: number) => {
    const response = await api.get(`/api/books/${bookId}`);
    return response.data.data;
  },

  getSpecificPage: async (bookId: number, pageNumber: number) => {
    const response = await api.get(`/api/books/${bookId}/pages/${pageNumber}`);
    return response.data.data;
  },

  getPageById: async (bookId: number, pageId: string | number) => {
    const response = await api.get(`/api/books/${bookId}/pages/${pageId}`);
    return response.data.data;
  },

  // Models
  getModels: async (): Promise<{ models: Array<{ ModelId: number; ModelName: string; Description: string }>; total: number }> => {
    const response = await api.get('/api/models');
    return response.data.data;
  },

  // Prompts
  getPrompts: async (): Promise<{ prompts: Array<{ PromptId: number; Prompt: string }>; total: number }> => {
    const response = await api.get('/api/prompts');
    return response.data.data;
  },
  createPrompt: async (Prompt: string): Promise<{ PromptId: number; Prompt: string }> => {
    const response = await api.post('/api/prompts', { Prompt });
    return response.data.data;
  },

  // Categories
  getCategories: async (params?: { ModelId?: number; PromptId?: number }) => {
    const query = params ? `?${new URLSearchParams(Object.entries(params).reduce((acc, [k, v]) => { if (v !== undefined && v !== null) acc[k] = String(v); return acc; }, {} as Record<string,string>)).toString()}` : '';
    const response = await api.get(`/api/categories${query}`);
    return response.data.data;
  },
  createCategory: async (payload: { Name: string; Description: string; ModelId: number; PromptId: number }) => {
    const response = await api.post('/api/categories', payload);
    return response.data.data; // contains CategoryId and details
  },

  // Explanations
  generateExplanation: async (pageIds: number[], categoryId: number): Promise<{
    status: string;
    message: string;
    data: {
      explanations: Array<{
        ExplanationId: number;
        Response: string;
        CategoryId: number;
        PageId: number;
        created_at: string;
      }>;
      category: any;
      processedPages: number;
      ocrResults: any[];
      aiResponse: string;
      statistics: any;
    };
  }> => {
    const response = await api.post('/api/explanations/generate', {
      pageIds,
      categoryId,
    });
    return response.data;
  },

  generateExplanationByPageNumbers: async (
    bookId: number,
    pageNumbers: number[],
    categoryId: number
  ): Promise<{
    status: string;
    message: string;
    data: any;
  }> => {
    const response = await api.post('/api/explanations/generate', {
      bookId,
      pageNumbers,
      categoryId,
    });
    return response.data;
  },

  // Get individual page by page number - optimized for single page extraction
  getPageByNumber: async (bookId: number, pageNumber: number) => {
    const response = await api.get(`/api/books/${bookId}/pages/${pageNumber}`);
    return response.data;
  },

  // Users - Change Password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ status: string; message: string }> => {
    const response = await api.post('/api/users/change-password', { currentPassword, newPassword });
    return response.data;
  },
};
