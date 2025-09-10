'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  BookOpenIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

interface Question {
  QuestionId: number;
  Questions: string;
  Answers: string;
  myAnswer: string | null;
  Options: any;
  Explanation: string;
}

interface Quiz {
  QuizId: number;
  Difficulty: string;
  Pages: any;
  UserId: number;
  Score: number;
  created_at: string;
  updated_at: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = parseInt(params.quizId as string);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const response = await apiService.getQuiz(quizId);
      setQuiz(response.quiz);
      setQuestions(response.questions);
      
      // Check if quiz is already completed
      if (response.quiz.Score > 0) {
        setSubmitted(true);
        // Pre-fill answers if already submitted
        const answers: Record<number, string> = {};
        response.questions.forEach(q => {
          if (q.myAnswer) {
            answers[q.QuestionId] = q.myAnswer;
          }
        });
        setUserAnswers(answers);
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch quiz:', error);
      toast.error('Failed to load quiz');
      router.push('/quiz/history');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, answer: string) => {
    if (submitted) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(userAnswers).length !== questions.length) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiService.submitQuiz(quizId, userAnswers);
      setResults(response);
      setSubmitted(true);
      toast.success(`Quiz submitted! Score: ${response.score.toFixed(1)}%`);
    } catch (error: any) {
      console.error('❌ Failed to submit quiz:', error);
      toast.error('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const getOptionLabel = (optionKey: string) => {
    return optionKey.toUpperCase();
  };

  const isCorrectAnswer = (questionId: number, option: string) => {
    if (!submitted) return false;
    const question = questions.find(q => q.QuestionId === questionId);
    return question?.Answers === option;
  };

  const isUserAnswer = (questionId: number, option: string) => {
    return userAnswers[questionId] === option;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center border border-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-gray-400">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-red-400 mb-4">Quiz not found</p>
          <button 
            onClick={() => router.push('/quiz/history')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Back to Quiz History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <AcademicCapIcon className="h-8 w-8 text-green-400" />
              <div>
                <h1 className="text-2xl font-bold">Quiz #{quiz.QuizId}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span className="flex items-center space-x-1">
                    <ClockIcon className="h-4 w-4" />
                    <span>Difficulty: {quiz.Difficulty}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <BookOpenIcon className="h-4 w-4" />
                    <span>{questions.length} Questions</span>
                  </span>
                  {submitted && (
                    <span className="flex items-center space-x-1 text-green-400">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>Score: {quiz.Score.toFixed(1)}%</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/quiz/history')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Back to History
            </button>
          </div>
        </div>
      </div>

      {/* Quiz Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-8">
          {questions.map((question, index) => {
            const options = typeof question.Options === 'string' 
              ? JSON.parse(question.Options) 
              : question.Options;

            return (
              <div key={question.QuestionId} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">
                    Question {index + 1}
                  </h3>
                  <p className="text-gray-200">{question.Questions}</p>
                </div>

                <div className="space-y-3">
                  {Object.entries(options).map(([key, value]) => {
                    const isSelected = isUserAnswer(question.QuestionId, key);
                    const isCorrect = isCorrectAnswer(question.QuestionId, key);
                    const showResult = submitted;

                    let buttonClass = "w-full text-left p-4 rounded-lg border transition-colors ";
                    
                    if (showResult) {
                      if (isCorrect) {
                        buttonClass += "border-green-500 bg-green-900/30 text-green-100";
                      } else if (isSelected && !isCorrect) {
                        buttonClass += "border-red-500 bg-red-900/30 text-red-100";
                      } else {
                        buttonClass += "border-gray-600 bg-gray-700 text-gray-300";
                      }
                    } else {
                      if (isSelected) {
                        buttonClass += "border-blue-500 bg-blue-900/30 text-blue-100";
                      } else {
                        buttonClass += "border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-600";
                      }
                    }

                    return (
                      <button
                        key={key}
                        onClick={() => handleAnswerChange(question.QuestionId, key)}
                        disabled={submitted}
                        className={buttonClass}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="font-semibold text-sm bg-gray-600 px-2 py-1 rounded">
                              {getOptionLabel(key)}
                            </span>
                            <span>{value as string}</span>
                          </div>
                          {showResult && isCorrect && (
                            <CheckCircleIcon className="h-5 w-5 text-green-400" />
                          )}
                          {showResult && isSelected && !isCorrect && (
                            <XCircleIcon className="h-5 w-5 text-red-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Show explanation after submission */}
                {submitted && question.Explanation && (
                  <div className="mt-4 p-4 bg-gray-700 rounded-lg border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-400 mb-2">Explanation:</h4>
                    <p className="text-gray-200 text-sm">{question.Explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        {!submitted && (
          <div className="mt-8 text-center">
            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(userAnswers).length !== questions.length}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
            <p className="text-gray-400 text-sm mt-2">
              {Object.keys(userAnswers).length}/{questions.length} questions answered
            </p>
          </div>
        )}

        {/* Results Summary */}
        {submitted && results && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-center">Quiz Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">{results.score.toFixed(1)}%</div>
                <div className="text-gray-400">Final Score</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-400">{results.correctAnswers}</div>
                <div className="text-gray-400">Correct Answers</div>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-400">{results.totalQuestions}</div>
                <div className="text-gray-400">Total Questions</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
