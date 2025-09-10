'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  XMarkIcon,
  EyeIcon,
  ArrowLeftIcon,
  SparklesIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
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
  const [selectedPageIds, setSelectedPageIds] = useState<number[]>([]);
  const [explaining, setExplaining] = useState(false);
  const [explanations, setExplanations] = useState<Array<{pageNumber: number, explanation: string}>>([]);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  // Debug logging to see what's happening
  useEffect(() => {
    console.log('Selected PageIds array:', selectedPageIds);
  }, [selectedPageIds]);

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

  const togglePageSelection = (pageNumber: number) => {
    console.log('Toggling page selection for pageNumber:', pageNumber);
    
    // Find the PageId for this pageNumber
    const page = bookDetails?.pages.find(p => p.pageNumber === pageNumber);
    if (!page) {
      console.error('Page not found for pageNumber:', pageNumber);
      return;
    }
    
    const pageId = page.PageId;
    console.log('PageId for pageNumber', pageNumber, ':', pageId);
    
    setSelectedPageIds(prevSelectedPageIds => {
      console.log('Previous selected PageIds:', prevSelectedPageIds);
      
      // Check if the PageId is already in the selection
      if (prevSelectedPageIds.includes(pageId)) {
        // If it is, remove it from the array (deselect)
        const newSelection = prevSelectedPageIds.filter((id: number) => id !== pageId);
        console.log('Deselecting PageId, new selection:', newSelection);
        return newSelection;
      } else {
        // If it's not, add it to the array (select)
        const newSelection = [...prevSelectedPageIds, pageId];
        console.log('Selecting PageId, new selection:', newSelection);
        return newSelection;
      }
    });
  };

  const explainSelectedPages = async () => {
    if (!bookDetails || selectedPageIds.length === 0) {
      toast.error('Please select at least one page to explain');
      return;
    }

    try {
      setExplaining(true);
      setExplanations([]);
      
      // Use selectedPageIds directly
      console.log('Selected PageIds for explanation:', selectedPageIds);

      if (selectedPageIds.length === 0) {
        toast.error('No pages selected for explanation');
        return;
      }

      // Make actual API call to generate explanations using direct API call
      const categoryId = 1; // This should come from user selection or default category
      
      // Get token and user info
      const token = localStorage.getItem('xeno_token');
      if (!token) {
        toast.error('Please log in to generate explanations');
        return;
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      console.log('Making explanation request with:', {
        pageIds: selectedPageIds,
        categoryId: categoryId,
        token: token ? 'Present' : 'Missing'
      });

      const response = await axios.post(`${API_BASE_URL}/api/explanations/generate`, {
        pageIds: selectedPageIds,
        categoryId: categoryId
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('API Response:', response.data);

      // Process the API response
      const explanationResults = [];
      console.log('Processing API response structure:', response.data);
      
      if (response.data && response.data.data && response.data.data.explanations) {
        for (const explanation of response.data.data.explanations) {
          // Find the corresponding page number for this PageId
          const page = bookDetails.pages.find(p => p.PageId === explanation.PageId);
          if (page) {
            explanationResults.push({
              pageNumber: page.pageNumber,
              explanation: explanation.Response || 'No explanation available'
            });
          }
        }
      } else if (response.data && response.data.data && response.data.data.aiResponse) {
        // Handle case where there's a single combined response for all pages
        const combinedExplanation = response.data.data.aiResponse;
        selectedPageIds.forEach(pageId => {
          const page = bookDetails.pages.find(p => p.PageId === pageId);
          if (page) {
            explanationResults.push({
              pageNumber: page.pageNumber,
              explanation: combinedExplanation
            });
          }
        });
      }

      // Sort by page number for consistent display
      explanationResults.sort((a, b) => a.pageNumber - b.pageNumber);

      setExplanations(explanationResults);
      setShowExplanationModal(true);
      toast.success(`Generated explanations for ${explanationResults.length} pages`);
      
    } catch (error: any) {
      console.error('Error generating explanations:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
      } else if (error.response?.status === 400) {
        toast.error('Invalid request. Please check your selection.');
      } else {
        const errorMessage = error?.response?.data?.message || error.message || 'Failed to generate explanations';
        toast.error(errorMessage);
      }
    } finally {
      setExplaining(false);
    }
  };

  const generateQuizFromSelectedPages = async () => {
    if (!bookDetails || selectedPageIds.length === 0) {
      toast.error('Please select at least one page to generate quiz');
      return;
    }

    try {
      setGeneratingQuiz(true);
      
      // Convert PageIds to strings for the quiz API
      const pageIdsAsStrings = selectedPageIds.map(id => id.toString());

      console.log('Selected PageIds for quiz:', selectedPageIds);
      console.log('PageIds as strings:', pageIdsAsStrings);

      if (pageIdsAsStrings.length === 0) {
        toast.error('No pages selected for quiz generation');
        return;
      }

      // Direct API call to generate quiz
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${API_BASE_URL}/api/quizzes/generate`, {
        pageIds: pageIdsAsStrings,
        difficulty: 'medium',
        questionCount: 10
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('xeno_token') || ''}`
        }
      });
      
      console.log('Quiz generation response:', response.data);
      
      toast.success(`Quiz generated successfully with ${selectedPageIds.length} pages!`);
      
      // Navigate to the quiz page
      router.push(`/quiz/${response.data.quiz.quizId}`);
      
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      console.error('Error details:', error?.response?.data);
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error.message || 'Failed to generate quiz';
      toast.error(errorMessage);
    } finally {
      setGeneratingQuiz(false);
    }
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
            {selectedPageIds.length > 0 && (
              <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                {selectedPageIds.length} selected
              </span>
            )}
            {selectedPageIds.length > 0 && (
              <>
                <button
                  onClick={explainSelectedPages}
                  disabled={explaining}
                  className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>{explaining ? 'Explaining...' : 'Explain Selected'}</span>
                </button>
                <button
                  onClick={generateQuizFromSelectedPages}
                  disabled={generatingQuiz}
                  className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <AcademicCapIcon className="h-4 w-4" />
                  <span>{generatingQuiz ? 'Generating Quiz...' : 'Generate Quiz'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {bookDetails.pages.map((page: Page, idx: number) => (
            <div
              key={page.PageId}
              className={`relative group bg-gray-800 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                selectedPageIds.includes(page.PageId)
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
                
                {/* Selection checkbox */}
                <div className="absolute top-2 left-2 z-30">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.includes(page.PageId)}
                      onChange={() => togglePageSelection(page.pageNumber)}
                      className="w-5 h-5 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Overlay with actions */}
                <div className="absolute inset-0 z-10 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2 pointer-events-auto">
                    <button
                      onClick={() => viewSinglePage(page.pageNumber)}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors"
                      title="View Page"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                  </div>
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

      {/* Explanation Modal */}
      {showExplanationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-11/12 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center space-x-2 text-white">
                <SparklesIcon className="h-5 w-5 text-indigo-400" />
                <h2 className="font-semibold">Explanations for {explanations.length} page(s)</h2>
              </div>
              <button
                onClick={() => setShowExplanationModal(false)}
                className="p-2 hover:bg-gray-800 rounded text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              {explanations.length > 0 ? (
                <div className="space-y-6">
                  {explanations.map((item, index) => (
                    <div key={index} className="border-b border-gray-700 pb-4 last:border-b-0">
                      <h3 className="text-lg font-medium text-white mb-2">Page {item.pageNumber}</h3>
                      <p className="text-gray-300 leading-relaxed">{item.explanation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No explanations available</p>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setShowExplanationModal(false)}
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