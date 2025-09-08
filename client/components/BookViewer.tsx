'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  XMarkIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon
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
    created_at: string;
    uploaded_at: string;
    lastopened_at?: string;
  };
  pages: Page[];
  totalPages: number;
}

interface BookViewerProps {
  bookId: number;
  onClose?: () => void;
}

export default function BookViewer({ bookId, onClose }: BookViewerProps) {
  const router = useRouter();
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPageData, setCurrentPageData] = useState<Page | null>(null);

  useEffect(() => {
    fetchBookDetails();
  }, [bookId]);

  useEffect(() => {
    if (bookDetails && currentPage) {
      fetchCurrentPageData(currentPage);
    }
  }, [bookDetails, currentPage]);

  const fetchBookDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching book details for bookId:', bookId);
      
      // Get book details and total pages first
      const bookInfo = await apiService.getBookDetails(bookId);
      console.log('📚 Book info received:', bookInfo);
      
      // Set initial book details with empty pages array
      setBookDetails({
        book: bookInfo.book,
        pages: [],
        totalPages: bookInfo.totalPages
      });
      
      if (bookInfo.totalPages > 0) {
        setCurrentPage(1);
        console.log('✅ Set current page to 1, total pages:', bookInfo.totalPages);
      } else {
        console.log('⚠️ No pages found in book');
      }
    } catch (error: any) {
      console.error('❌ Error fetching book details:', error);
      console.error('Error details:', error.response?.data);
      toast.error(`Failed to load book details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const goToPage = async (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= (bookDetails?.totalPages || 0)) {
      setCurrentPage(pageNumber);
      setImageLoading(true);
      await fetchCurrentPageData(pageNumber);
    }
  };

  const fetchCurrentPageData = async (pageNumber: number) => {
    try {
      console.log(`🔍 Fetching individual page ${pageNumber} for bookId:`, bookId);
      const pageResponse = await apiService.getPageByNumber(bookId, pageNumber);
      console.log('📄 Individual page data received:', pageResponse);
      
      if (pageResponse.status === 'success' && pageResponse.data) {
        const pageData = {
          PageId: pageResponse.data.PageId,
          pageNumber: pageResponse.data.pageNumber,
          pageURL: pageResponse.data.pageURL,
          cloudinaryId: pageResponse.data.cloudinaryId
        };
        setCurrentPageData(pageData);
        console.log('✅ Current page data set:', pageData);
      } else {
        console.error('❌ Invalid page response:', pageResponse);
        setCurrentPageData(null);
      }
    } catch (error: any) {
      console.error(`❌ Error fetching page ${pageNumber}:`, error);
      toast.error(`Failed to load page ${pageNumber}`);
      setCurrentPageData(null);
    } finally {
      setImageLoading(false);
    }
  };

  const nextPage = () => {
    if (currentPage < (bookDetails?.totalPages || 0)) {
      goToPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'Escape') handleClose();
    if (e.key === '+' || e.key === '=') handleZoomIn();
    if (e.key === '-') handleZoomOut();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, bookDetails]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 flex flex-col items-center border border-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-gray-400">Loading book...</p>
        </div>
      </div>
    );
  }

  if (!bookDetails) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-red-400 mb-4">Failed to load book</p>
          <button onClick={handleClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
    );
  }

  // Debug current page data
  console.log('🔍 Current page:', currentPage);
  console.log('📄 Current page data:', currentPageData);
  console.log('🔗 Current page URL:', currentPageData?.pageURL);

  return (
    <div className={`min-h-screen bg-black ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className={`bg-gray-900 border-b border-gray-700 shadow-lg p-4 flex items-center justify-between ${isFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{bookDetails.book.Name}</h1>
            <p className="text-sm text-gray-400">by {bookDetails.book.author}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
            disabled={zoom <= 0.5}
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5" />
          </button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
            disabled={zoom >= 3}
          >
            <MagnifyingGlassPlusIcon className="h-5 w-5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-5 w-5" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5" />
            )}
          </button>

          {/* Page Navigation */}
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= bookDetails.totalPages) {
                    goToPage(page);
                  }
                }}
                className="w-16 px-2 py-1 text-center border border-gray-600 rounded text-sm bg-gray-800 text-white"
                min={1}
                max={bookDetails.totalPages}
              />
              <span className="text-sm text-gray-400">of {bookDetails.totalPages}</span>
            </div>

            <button
              onClick={nextPage}
              disabled={currentPage === bookDetails.totalPages}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {currentPageData ? (
          <div className="relative max-w-full max-h-full">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
            <img
              src={currentPageData.pageURL}
              alt={`Page ${currentPage}`}
              className="max-w-full max-h-full object-contain shadow-2xl"
              style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'center center'
              }}
              onLoad={() => {
                console.log('✅ Image loaded successfully:', currentPageData.pageURL);
              }}
              onError={() => {
                console.error('❌ Failed to load image:', currentPageData.pageURL);
                toast.error(`Failed to load page image: ${currentPageData.pageURL}`);
              }}
            />
            {/* Debug info overlay */}
            <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
              <p>Page: {currentPage}</p>
              <p>PageId: {currentPageData.PageId}</p>
              <p>URL: {currentPageData.pageURL?.substring(0, 50)}...</p>
            </div>
          </div>
        ) : (
          <div className="text-white text-center">
            <p className="text-xl mb-2">Page not found</p>
            <p className="text-gray-300">Unable to load page {currentPage}</p>
            <div className="mt-4 text-sm text-gray-400">
              <p>Debug info:</p>
              <p>Total pages: {bookDetails?.totalPages || 0}</p>
              <p>Current page: {currentPage}</p>
              <p>Page data loaded: {currentPageData ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Controls */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg p-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-colors disabled:opacity-50"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
          
          <span className="text-white text-sm px-2">
            {currentPage} / {bookDetails.totalPages}
          </span>

          <button
            onClick={nextPage}
            disabled={currentPage === bookDetails.totalPages}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-colors disabled:opacity-50"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-colors ml-2"
          >
            <ArrowsPointingInIcon className="h-6 w-6" />
          </button>

          <button
            onClick={handleClose}
            className="p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {!isFullscreen && (
        <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-75 text-gray-300 text-xs p-2 rounded border border-gray-700">
          <p>← → Navigate | + - Zoom | F Fullscreen | ESC Close</p>
        </div>
      )}
    </div>
  );
}
