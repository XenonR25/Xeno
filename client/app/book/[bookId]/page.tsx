'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BookViewerPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = parseInt(params.bookId as string);

  useEffect(() => {
    // Redirect to pages route
    if (!isNaN(bookId)) {
      router.replace(`/book/${bookId}/pages`);
    }
  }, [bookId, router]);

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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
    </div>
  );
}
