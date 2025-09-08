'use client';

import Link from 'next/link';
import { BookOpenIcon, ArrowRightOnRectangleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { authService } from '@/lib/auth';
import { User } from '@/types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const handleLogout = () => {
    authService.logout();
    onLogout();
  };

  return (
    <header className="bg-gray-900 shadow-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <BookOpenIcon className="h-8 w-8 text-white mr-3" />
            <h1 className="text-2xl font-bold text-white">Xeno</h1>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                Welcome, <span className="font-medium text-white">{user.UserName}</span>
              </span>
              <Link
                href="/settings"
                className="inline-flex items-center text-sm text-gray-300 hover:text-white px-3 py-2 rounded hover:bg-gray-800 transition-colors"
                title="Settings"
              >
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-outline"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
