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
      category: {
        CategoryId: number;
        CategoryName: string;
        CategoryDescription: string;
        ModelId: number;
        ModelName: string;
        ModelDescription: string;
        PromptId: number;
        Prompt: string;
      };
      processedPages: number;
      ocrResults: Array<{
        pageId: number;
        pageNumber: number;
        extractedText: string;
        status: string;
      }>;
      aiResponse: string;
      statistics: {
        totalPages: number;
        successfulOCR: number;
        failedOCR: number;
        contextLength: number;
        responseLength: number;
      };
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
    data: {
      explanations: Array<{
        ExplanationId: number;
        Response: string;
        CategoryId: number;
        PageId: number;
        created_at: string;
      }>;
      category: {
        CategoryId: number;
        CategoryName: string;
        CategoryDescription: string;
        ModelId: number;
        ModelName: string;
        ModelDescription: string;
        PromptId: number;
        Prompt: string;
      };
      processedPages: number;
      ocrResults: Array<{
        pageId: number;
        pageNumber: number;
        extractedText: string;
        status: string;
      }>;
      aiResponse: string;
      statistics: {
        totalPages: number;
        successfulOCR: number;
        failedOCR: number;
        contextLength: number;
        responseLength: number;
      };
    };
  }> => {
    const response = await api.post('/api/explanations/generate', {
      bookId,
      pageNumbers,
      categoryId,
    });
    return response.data;
  },

  // Get explanations with filters
  getExplanations: async (categoryId?: number, pageId?: number): Promise<{
    status: string;
    data: {
      explanations: Array<{
        ExplanationId: number;
        Response: string;
        CategoryId: number;
        PageId: number;
        created_at: string;
        CategoryName: string;
        CategoryDescription: string;
        pageNumber: number;
        pageURL: string;
      }>;
      total: number;
      filters: { categoryId?: number; pageId?: number };
    };
  }> => {
    const params = new URLSearchParams();
    if (categoryId) params.append('categoryId', categoryId.toString());
    if (pageId) params.append('pageId', pageId.toString());
    
    const response = await api.get(`/api/explanations?${params.toString()}`);
    return response.data;
  },

  // Get specific explanation by ID
  getExplanationById: async (explanationId: number): Promise<{
    status: string;
    data: {
      ExplanationId: number;
      Response: string;
      CategoryId: number;
      PageId: number;
      created_at: string;
      CategoryName: string;
      CategoryDescription: string;
      pageNumber: number;
      pageURL: string;
      ModelName: string;
      Prompt: string;
    };
  }> => {
    const response = await api.get(`/api/explanations/${explanationId}`);
    return response.data;
  },

  // Update explanation
  updateExplanation: async (explanationId: number, responseText: string): Promise<{
    status: string;
    message: string;
    data: {
      ExplanationId: number;
      Response: string;
      CategoryId: number;
      PageId: number;
      created_at: string;
    };
  }> => {
    const response = await api.put(`/api/explanations/${explanationId}`, {
      Response: responseText,
    });
    return response.data;
  },

  // Delete explanation
  deleteExplanation: async (explanationId: number): Promise<{
    status: string;
    message: string;
    data: {
      ExplanationId: number;
      Response: string;
    };
  }> => {
    const response = await api.delete(`/api/explanations/${explanationId}`);
    return response.data;
  },

  getPageByNumber: async (bookId: number, pageNumber: number) => {
    const response = await api.get(`/api/books/${bookId}/pages/${pageNumber}`);
    return response.data;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{
    status: string;
    message: string;
  }> => {
    const response = await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  // Generate quiz for specific pages
  generateQuiz: async (pageIds: string[], difficulty: string = 'medium'): Promise<{
    success: boolean;
    quiz: {
      quizId: number;
      difficulty: string;
      pages: Array<{
        pageId: string;
        pageNumber: number;
        bookTitle: string;
        bookId: number;
      }>;
      userId: number;
      createdAt: string;
      score: number;
    };
    questions: Array<{
      questionId: number;
      question: string;
      options: any;
      correctAnswer: string;
      explanation: string;
      myAnswer: null;
    }>;
  }> => {
    const response = await api.post('/api/quizzes/generate', {
      pageIds,
      difficulty,
      questionCount: 10
    });
    return response.data;
  },

  // Get quiz by ID
  getQuiz: async (quizId: number): Promise<{
    quiz: {
      QuizId: number;
      Difficulty: string;
      Pages: any;
      UserId: number;
      Score: number;
      created_at: string;
      updated_at: string;
    };
    questions: Array<{
      QuestionId: number;
      Questions: string;
      Answers: string;
      myAnswer: string | null;
      Options: any;
      Explanation: string;
    }>;
  }> => {
    const response = await api.get(`/api/quizzes/${quizId}`);
    return response.data;
  },

  // Submit quiz answers
  submitQuiz: async (quizId: number, answers: Record<number, string>): Promise<{
    success: boolean;
    quizId: number;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    results: Array<{
      questionId: number;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
    }>;
  }> => {
    const response = await api.post(`/api/quizzes/${quizId}/submit`, {
      answers
    });
    return response.data;
  },

  // Get user's quiz history
  getUserQuizzes: async (userId: number): Promise<{
    quizzes: Array<{
      QuizId: number;
      Difficulty: string;
      Pages: any;
      Score: number;
      created_at: string;
      updated_at: string;
      question_count: number;
    }>;
  }> => {
    const response = await api.get(`/api/quizzes/user/${userId}`);
    return response.data;
  },
};
