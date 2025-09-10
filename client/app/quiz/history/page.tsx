'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { authService } from '@/lib/auth';
import toast from 'react-hot-toast';
import { 
  AcademicCapIcon,
  ClockIcon,
  BookOpenIcon,
  TrophyIcon,
  EyeIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface QuizHistoryItem {
  QuizId: number;
  Difficulty: string;
  Pages: any;
  Score: number;
  created_at: string;
  updated_at: string;
  question_count: number;
}

export default function QuizHistoryPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);
    fetchQuizHistory(currentUser.UserId);
  }, []);

  const fetchQuizHistory = async (userId: number) => {
    try {
      setLoading(true);
      const response = await apiService.getUserQuizzes(userId);
      setQuizzes(response.quizzes);
    } catch (error: any) {
      console.error('❌ Failed to fetch quiz history:', error);
      toast.error('Failed to load quiz history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'text-green-400 bg-green-900/30 border-green-500';
      case 'medium':
        return 'text-yellow-400 bg-yellow-900/30 border-yellow-500';
      case 'hard':
        return 'text-red-400 bg-red-900/30 border-red-500';
      default:
        return 'text-gray-400 bg-gray-900/30 border-gray-500';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPageInfo = (pages: any) => {
    try {
      const pagesArray = typeof pages === 'string' ? JSON.parse(pages) : pages;
      if (Array.isArray(pagesArray) && pagesArray.length > 0) {
        const firstPage = pagesArray[0];
        return {
          bookTitle: firstPage.bookTitle || 'Unknown Book',
          pageCount: pagesArray.length,
          pageNumbers: pagesArray.map(p => p.pageNumber).join(', ')
        };
      }
    } catch (error) {
      console.error('Error parsing pages:', error);
    }
    return {
      bookTitle: 'Unknown Book',
      pageCount: 0,
      pageNumbers: ''
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center border border-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-gray-400">Loading quiz history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <TrophyIcon className="h-8 w-8 text-yellow-400" />
              <div>
                <h1 className="text-2xl font-bold">Quiz History</h1>
                <p className="text-gray-400">
                  {user?.UserName ? `${user.UserName}'s quiz attempts` : 'Your quiz attempts'}
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Back to Library
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {quizzes.length === 0 ? (
          <div className="text-center py-12">
            <AcademicCapIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No quizzes yet</h3>
            <p className="text-gray-500 mb-6">
              Start by generating a quiz from any book page to see your history here.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
            >
              Browse Books
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <AcademicCapIcon className="h-8 w-8 text-blue-400" />
                  <div>
                    <div className="text-2xl font-bold">{quizzes.length}</div>
                    <div className="text-gray-400 text-sm">Total Quizzes</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <TrophyIcon className="h-8 w-8 text-yellow-400" />
                  <div>
                    <div className="text-2xl font-bold">
                      {quizzes.length > 0 
                        ? (quizzes.reduce((sum, q) => sum + q.Score, 0) / quizzes.length).toFixed(1)
                        : '0'
                      }%
                    </div>
                    <div className="text-gray-400 text-sm">Average Score</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <ClockIcon className="h-8 w-8 text-green-400" />
                  <div>
                    <div className="text-2xl font-bold">
                      {quizzes.filter(q => q.Score >= 80).length}
                    </div>
                    <div className="text-gray-400 text-sm">High Scores (80%+)</div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center space-x-3">
                  <BookOpenIcon className="h-8 w-8 text-purple-400" />
                  <div>
                    <div className="text-2xl font-bold">
                      {quizzes.reduce((sum, q) => sum + q.question_count, 0)}
                    </div>
                    <div className="text-gray-400 text-sm">Questions Answered</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quiz List */}
            <div className="space-y-4">
              {quizzes.map((quiz) => {
                const pageInfo = getPageInfo(quiz.Pages);
                const isCompleted = quiz.Score > 0;

                return (
                  <div
                    key={quiz.QuizId}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-3">
                          <h3 className="text-lg font-semibold">Quiz #{quiz.QuizId}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getDifficultyColor(quiz.Difficulty)}`}>
                            {quiz.Difficulty.toUpperCase()}
                          </span>
                          {isCompleted && (
                            <span className={`text-lg font-bold ${getScoreColor(quiz.Score)}`}>
                              {quiz.Score.toFixed(1)}%
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
                          <div className="flex items-center space-x-2">
                            <BookOpenIcon className="h-4 w-4" />
                            <span>{pageInfo.bookTitle}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CalendarIcon className="h-4 w-4" />
                            <span>Created: {formatDate(quiz.created_at)}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <AcademicCapIcon className="h-4 w-4" />
                            <span>{quiz.question_count} questions</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>Pages: {pageInfo.pageNumbers}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => router.push(`/quiz/${quiz.QuizId}`)}
                          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        >
                          <EyeIcon className="h-4 w-4" />
                          <span>{isCompleted ? 'Review' : 'Continue'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
