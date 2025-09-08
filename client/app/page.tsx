'use client';

import { useState, useEffect } from 'react';
import { authService } from '@/lib/auth';
import { User } from '@/types';
import AuthForm from '@/components/AuthForm';
import Header from '@/components/Header';
import BookUpload from '@/components/BookUpload';
import BookList from '@/components/BookList';
import { PlusIcon, BookOpenIcon } from '@heroicons/react/24/outline';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const isAuth = authService.isAuthenticated();
      const userData = authService.getUser();
      setIsAuthenticated(isAuth);
      setUser(userData);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = () => {
    const userData = authService.getUser();
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setActiveTab('upload');
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('library');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={handleLogout} />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upload'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <PlusIcon className="h-5 w-5 inline mr-2" />
                Upload Book
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'library'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BookOpenIcon className="h-5 w-5 inline mr-2" />
                My Library
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'upload' ? (
            <BookUpload onUploadSuccess={handleUploadSuccess} />
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">My Library</h2>
                <p className="text-gray-600">Manage your uploaded books</p>
              </div>
              <BookList refreshTrigger={refreshTrigger} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
