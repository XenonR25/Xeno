'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpenIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import { apiService } from '@/lib/api';
import { Book } from '@/types';
import toast from 'react-hot-toast';

interface BookListProps {
  refreshTrigger?: number;
}

export default function BookList({ refreshTrigger }: BookListProps) {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const fetchBooks = async (page = 1) => {
    try {
      setLoading(true);
      const response = await apiService.getBooks(page, pagination.limit);
      setBooks(response.books);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Error fetching books:', error);
      toast.error('Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [refreshTrigger]);

  const handleDelete = async (bookId: number, bookName: string) => {
    if (!confirm(`Are you sure you want to delete "${bookName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteBook(bookId);
      toast.success('Book deleted successfully');
      fetchBooks(pagination.page);
    } catch (error: any) {
      console.error('Error deleting book:', error);
      toast.error('Failed to delete book');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No books uploaded yet</h3>
        <p className="text-gray-400">Upload your first PDF book to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <div key={book.BookId} className="card p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1 line-clamp-2">
                  {book.Name}
                </h3>
                <p className="text-sm text-gray-400 mb-2">by {book.author}</p>
                <div className="flex items-center text-xs text-gray-500 space-x-4">
                  <span>{book.totalPages} pages</span>
                  <span>Uploaded {formatDate(book.uploaded_at)}</span>
                </div>
              </div>
              <BookOpenIcon className="h-8 w-8 text-gray-400 flex-shrink-0 ml-3" />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => {
                  router.push(`/book/${book.BookId}/pages`);
                }}
                className="flex-1 btn btn-outline text-xs"
              >
                <EyeIcon className="h-3 w-3 mr-1" />
                View
              </button>
              <button
                onClick={() => handleDelete(book.BookId, book.Name)}
                className="btn bg-gray-800 text-red-400 hover:bg-gray-700 border-gray-600 text-xs"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center space-x-4">
          <button
            onClick={() => fetchBooks(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => fetchBooks(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
