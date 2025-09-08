export interface User {
  UserId: number;
  UserName: string;
  Email: string;
  Phone?: string;
  created_at: string;
}

export interface Book {
  BookId: number;
  Name: string;
  author: string;
  created_at: string;
  uploaded_at: string;
  lastopened_at?: string;
  totalPages: number;
}

export interface Page {
  PageId: string;
  pageNumber: number;
  pageURL: string;
  cloudinaryId: string;
}

export interface BookUploadResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    book: Book;
    pages: Page[];
    processingInfo: {
      extractedText: any;
      imagesGenerated: number;
      originalPdfPublicId: string;
      originalPdfVersion: string;
    };
  };
  error?: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    token: string;
    user: User;
  };
  error?: string;
}

export interface UploadProgress {
  progress: number;
  stage: 'uploading' | 'processing' | 'extracting' | 'completed' | 'error';
  message: string;
}
