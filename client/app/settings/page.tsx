'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to a default tab inside Settings
    router.replace('/settings/account');
  }, [router]);

  return null;
}
