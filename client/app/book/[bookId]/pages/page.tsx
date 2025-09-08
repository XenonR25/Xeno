'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  EyeIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { apiService } from '@/lib/api';
import toast from 'react-hot-toast';

interface Page {
  PageId: number;
  pageNumber: number;
  pageURL: string;
  cloudinaryId: string;
}

interface BookDetails {
  book: {
    BookId: number;
    Name: string;
    author: string;
  };
  pages: Page[];
  totalPages: number;
}

export default function BookPagesPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = parseInt(params.bookId as string);
  
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  useEffect(() => {
    if (!isNaN(bookId)) {
      fetchBookPages();
    }
  }, [bookId]);

  const fetchBookPages = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching all pages for BookId:', bookId);
      
      const details = await apiService.getBookPages(bookId);
      console.log('📚 Book details received:', details);
      
      setBookDetails(details);
      
      // Log each page data
      if (details.pages) {
        details.pages.forEach((page: Page, index: number) => {
          console.log(`📄 Page ${index + 1}:`, {
            PageId: page.PageId,
            pageNumber: page.pageNumber,
            pageURL: page.pageURL,
            cloudinaryId: page.cloudinaryId
          });
        });
      }
    } catch (error: any) {
      console.error('❌ Error fetching book pages:', error);
      toast.error('Failed to load book pages');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const viewSinglePage = (pageNumber: number) => {
    router.push(`/book/${bookId}/pages/${pageNumber}`);
  };

  const togglePageSelection = (pageId: number) => {
    setSelectedPages(prev => 
      prev.includes(pageId) 
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  };

  if (isNaN(bookId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Invalid Book ID</h1>
          <p className="text-gray-600">The book ID provided is not valid.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center border border-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-white">Loading book pages...</p>
        </div>
      </div>
    );
  }

  if (!bookDetails) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-red-400 mb-4">Failed to load book pages</p>
          <button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors text-white"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{bookDetails.book.Name}</h1>
              <p className="text-sm text-gray-400">by {bookDetails.book.author}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-300">
              {bookDetails.totalPages} pages
            </span>
            {selectedPages.length > 0 && (
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                {selectedPages.length} selected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {bookDetails.pages.map((page) => (
            <div
              key={page.PageId}
              className={`relative group bg-gray-800 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                selectedPages.includes(page.PageId)
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Page Image */}
              <div className="aspect-[3/4] relative">
                <img
                  src={page.pageURL}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error(`Failed to load image for page ${page.pageNumber}:`, page.pageURL);
                    (e.target as HTMLImageElement).src = '/placeholder-page.png';
                  }}
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                    <button
                      onClick={() => viewSinglePage(page.pageNumber)}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors"
                      title="View Page"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Selection checkbox */}
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selectedPages.includes(page.PageId)}
                    onChange={() => togglePageSelection(page.PageId)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                  />
                </div>

                {/* Page number badge */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                  {page.pageNumber}
                </div>
              </div>

              {/* Page info */}
              <div className="p-3">
                <div className="text-sm text-gray-300">
                  <p className="font-medium">Page {page.pageNumber}</p>
                  <p className="text-xs text-gray-500 mt-1">ID: {page.PageId}</p>
                  {page.cloudinaryId && (
                    <p className="text-xs text-gray-500 truncate" title={page.cloudinaryId}>
                      {page.cloudinaryId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {bookDetails.pages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No pages found for this book</p>
          </div>
        )}
      </div>
    </div>
  );
}