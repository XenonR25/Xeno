'use client';

import dynamic from 'next/dynamic';

const CategoryForm = dynamic(() => import('@/components/CategoryForm'), { ssr: false });

export default function AICategorySettingsPage() {
  return (
    <div>
      <h2 className="text-xl text-white mb-4">AI Category</h2>
      <CategoryForm />
    </div>
  );
}
