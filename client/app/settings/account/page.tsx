'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '@/lib/api';

export default function AccountSettingsPage() {
  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  // Optional: phone (stub for later wiring)
  const [phone, setPhone] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    try {
      setChanging(true);
      toast.loading('Updating password...', { id: 'pwd' });
      const res = await apiService.changePassword(currentPassword, newPassword);
      toast.success(res?.message || 'Password changed successfully', { id: 'pwd' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to change password';
      toast.error(msg, { id: 'pwd' });
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl text-white mb-4">Account</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changing}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {changing ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="opacity-80">
        <h3 className="text-lg text-white mb-2">Phone</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., +1 555-555-5555"
              className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
