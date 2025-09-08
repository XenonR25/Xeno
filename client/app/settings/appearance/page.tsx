'use client';

import { useState } from 'react';

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

  return (
    <div>
      <h2 className="text-xl text-white mb-4">Appearance</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>
    </div>
  );
}
