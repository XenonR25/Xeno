'use client';

import { useParams } from 'next/navigation';
import IndividualPageViewer from '@/components/IndividualPageViewer';

export default function PageNumberPage() {
  const params = useParams();
  const bookId = parseInt(params.bookId as string);
  const pageNumber = parseInt(params.pageNumber as string);

  if (isNaN(bookId) || isNaN(pageNumber)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Invalid Parameters</h1>
          <p className="text-gray-300">The book ID or page number provided is not valid.</p>
        </div>
      </div>
    );
  }

  return (
    <IndividualPageViewer 
      bookId={bookId}
      initialPageNumber={pageNumber}
    />
  );
}
