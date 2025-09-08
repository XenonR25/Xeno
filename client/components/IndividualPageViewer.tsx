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
  ArrowsPointingInIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { apiService } from '@/lib/api';
import toast from 'react-hot-toast';

interface PageData {
  PageId: number;
  pageNumber: number;
  pageURL: string;
  cloudinaryId: string;
}

interface BookInfo {
  BookId: number;
  Name: string;
  author: string;
  totalPages: number;
}

interface IndividualPageViewerProps {
  bookId: number;
  initialPageNumber?: number;
  onClose?: () => void;
}

export default function IndividualPageViewer({ 
  bookId, 
  initialPageNumber = 1, 
  onClose 
}: IndividualPageViewerProps) {
  const router = useRouter();
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPageNumber);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [categories, setCategories] = useState<Array<{ CategoryId: number; Name: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanationModalOpen, setExplanationModalOpen] = useState(false);
  const [explanationText, setExplanationText] = useState<string>('');
  
  // Standardized zoom levels for a familiar experience
  const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

  useEffect(() => {
    fetchBookInfo();
  }, [bookId]);

  useEffect(() => {
    if (bookInfo) {
      fetchPageData(currentPage);
    }
  }, [bookInfo, currentPage]);

  // Fetch categories for explanations
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await apiService.getCategories();
        const list: Array<{ CategoryId: number; Name: string }> = result.categories?.map((c: any) => ({
          CategoryId: c.CategoryId,
          Name: c.Name,
        })) || [];
        setCategories(list);
        // Load default from localStorage
        let storedDefault: number | null = null;
        try {
          const val = localStorage.getItem('xeno.defaultCategoryId');
          if (val) storedDefault = parseInt(val);
        } catch {}
        if (storedDefault && list.some(c => c.CategoryId === storedDefault)) {
          setDefaultCategoryId(storedDefault);
          setSelectedCategoryId(storedDefault);
        } else if (list.length > 0 && selectedCategoryId === null) {
          setSelectedCategoryId(list[0].CategoryId);
        }
      } catch (error: any) {
        console.error('❌ Error loading categories:', error);
        toast.error('Failed to load explanation categories');
      }
    };
    loadCategories();
  }, []);

  const fetchBookInfo = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching book info for bookId:', bookId);
      
      const details = await apiService.getBookDetails(bookId);
      console.log('📚 Book info received:', details);
      
      setBookInfo({
        BookId: details.book.BookId,
        Name: details.book.Name,
        author: details.book.author,
        totalPages: details.totalPages
      });
      
      console.log('✅ Book info set, total pages:', details.totalPages);
    } catch (error: any) {
      console.error('❌ Error fetching book info:', error);
      toast.error(`Failed to load book info: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultCategory = () => {
    if (!selectedCategoryId) return;
    try {
      localStorage.setItem('xeno.defaultCategoryId', String(selectedCategoryId));
      setDefaultCategoryId(selectedCategoryId);
      toast.success('Default category saved');
    } catch {
      toast.error('Unable to save default category');
    }
  };

  const fetchPageData = async (pageNumber: number) => {
    try {
      setPageLoading(true);
      console.log(`🔍 Fetching page ${pageNumber} for bookId:`, bookId);
      
      const response = await apiService.getPageByNumber(bookId, pageNumber);
      console.log('📄 Page response received:', response);
      
      if (response.status === 'success' && response.data) {
        const page: PageData = {
          PageId: response.data.PageId,
          pageNumber: response.data.pageNumber,
          pageURL: response.data.pageURL,
          cloudinaryId: response.data.cloudinaryId
        };
        
        setPageData(page);
        console.log('✅ Page data set:', page);
      } else {
        console.error('❌ Invalid page response:', response);
        setPageData(null);
        toast.error(`Failed to load page ${pageNumber}`);
      }
    } catch (error: any) {
      console.error(`❌ Error fetching page ${pageNumber}:`, error);
      toast.error(`Failed to load page ${pageNumber}: ${error.message}`);
      setPageData(null);
    } finally {
      setPageLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= (bookInfo?.totalPages || 0)) {
      setCurrentPage(pageNumber);
    }
  };

  const nextPage = () => {
    if (currentPage < (bookInfo?.totalPages || 0)) {
      goToPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => {
      // Snap to the next standard zoom level
      const currentIndex = zoomLevels.reduce((acc, lvl, i) => (lvl <= prev ? i : acc), 0);
      const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
      return zoomLevels[nextIndex];
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      // Snap to the previous standard zoom level
      const currentIndex = zoomLevels.reduce((acc, lvl, i) => (lvl <= prev ? i : acc), 0);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return zoomLevels[prevIndex];
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleExplainPage = async () => {
    if (!pageData) {
      toast.error('No page loaded to explain');
      return;
    }
    if (!selectedCategoryId) {
      toast.error('Please select a category');
      return;
    }
    try {
      setExplaining(true);
      setExplanationText('');
      const resp = await apiService.generateExplanationByPageNumbers(bookId, [currentPage], selectedCategoryId);
      // Prefer aiResponse for display, fallback to first explanation Response
      const aiText = resp?.data?.aiResponse || resp?.data?.explanations?.[0]?.Response || 'No explanation text returned';
      setExplanationText(aiText);
      setExplanationModalOpen(true);
      toast.success('Explanation generated');
    } catch (error: any) {
      console.error('❌ Failed to generate explanation:', error);
      toast.error(error?.response?.data?.message || error.message || 'Failed to generate explanation');
    } finally {
      setExplaining(false);
    }
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
  }, [currentPage, bookInfo]);

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

  if (!bookInfo) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-red-400 mb-4">Failed to load book</p>
          <button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    );
  }

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
            <h1 className="text-xl font-bold text-white">{bookInfo.Name}</h1>
            <p className="text-sm text-gray-400">by {bookInfo.author}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
            disabled={zoom <= zoomLevels[0]}
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5" />
          </button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-white"
            disabled={zoom >= zoomLevels[zoomLevels.length - 1]}
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

          {/* Explanation Controls */}
          <div className="flex items-center space-x-2 ml-2">
            <select
              value={selectedCategoryId ?? ''}
              onChange={(e) => setSelectedCategoryId(parseInt(e.target.value))}
              className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-2 py-1"
            >
              {categories.length === 0 && <option value="" disabled>Loading categories...</option>}
              {categories.map((cat) => (
                <option key={cat.CategoryId} value={cat.CategoryId}>
                  {cat.Name}{defaultCategoryId === cat.CategoryId ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleSetDefaultCategory}
              disabled={!selectedCategoryId}
              className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-200 hover:bg-gray-800"
              title="Set selected as default"
            >
              Set Default
            </button>
            <a
              href="/settings/ai-category"
              className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
              title="Create or manage categories"
            >
              Manage
            </a>
            <button
              onClick={handleExplainPage}
              disabled={explaining || !selectedCategoryId}
              className="inline-flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded"
            >
              <SparklesIcon className="h-4 w-4" />
              <span>{explaining ? 'Explaining...' : 'Explain Page'}</span>
            </button>
          </div>

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
                  if (page >= 1 && page <= bookInfo.totalPages) {
                    goToPage(page);
                  }
                }}
                className="w-16 px-2 py-1 text-center border border-gray-600 rounded text-sm bg-gray-800 text-white"
                min={1}
                max={bookInfo.totalPages}
              />
              <span className="text-sm text-gray-400">of {bookInfo.totalPages}</span>
            </div>

            <button
              onClick={nextPage}
              disabled={currentPage === bookInfo.totalPages}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {pageData ? (
          <div className="relative max-w-full max-h-full">
            {pageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
            <img
              src={pageData.pageURL}
              alt={`Page ${currentPage}`}
              className="max-w-full max-h-full object-contain shadow-2xl"
              style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'center center'
              }}
              onLoad={() => {
                console.log('✅ Image loaded successfully:', pageData.pageURL);
              }}
              onError={() => {
                console.error('❌ Failed to load image:', pageData.pageURL);
                toast.error(`Failed to load page image`);
              }}
            />
            
          </div>
        ) : (
          <div className="text-white text-center">
            <p className="text-xl mb-2">Page not found</p>
            <p className="text-gray-300">Unable to load page {currentPage}</p>
            <div className="mt-4 text-sm text-gray-400">
              <p>Debug info:</p>
              <p>Total pages: {bookInfo?.totalPages || 0}</p>
              <p>Current page: {currentPage}</p>
              <p>Page loading: {pageLoading ? 'Yes' : 'No'}</p>
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
            {currentPage} / {bookInfo.totalPages}
          </span>

          <button
            onClick={nextPage}
            disabled={currentPage === bookInfo.totalPages}
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

      {/* Explanation Modal */}
      {explanationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-11/12 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center space-x-2 text-white">
                <SparklesIcon className="h-5 w-5 text-indigo-400" />
                <h2 className="font-semibold">Explanation for Page {pageData?.pageNumber}</h2>
              </div>
              <button
                onClick={() => setExplanationModalOpen(false)}
                className="p-2 hover:bg-gray-800 rounded text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              {explaining ? (
                <div className="flex items-center space-x-3 text-gray-300">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generating explanation...</span>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-gray-200 leading-relaxed text-sm">{explanationText}</pre>
              )}
            </div>
            <div className="p-3 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setExplanationModalOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
