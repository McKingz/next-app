'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { User, Bell, Lock, Globe, Moon, Sun, LogOut, Camera } from 'lucide-react';

export default function TeacherSettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/sign-in');
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserEmail(session.user.email);
      setUserId(session.user.id);
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <TeacherShell tenantSlug={slug} userEmail={userEmail}>
      <div className="container">
        <div className="section">
          <h1 className="h1">Settings</h1>
          <p className="muted">Manage your account preferences</p>
        </div>
        <div className="section">
          <div className="grid gap-6 max-w-3xl">

            {/* Profile Settings */}
            <div className="card p-md">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Profile</h2>
              </div>
              <div className="space-y-5">
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm text-gray-400 mb-4">Profile Picture</label>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt="Profile"
                          className="w-20 h-20 rounded-full object-cover border-2 border-blue-500"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-blue-500">
                          {userEmail?.[0]?.toUpperCase() || 'T'}
                        </div>
                      )}
                      <label className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors">
                        <Camera className="w-4 h-4 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 mb-1">Upload a profile picture</p>
                      <p className="text-xs text-gray-500">JPG, PNG or GIF (Max 2MB)</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors">
                  Save Changes
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="card p-md">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Notifications</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Email Notifications</div>
                    <div className="text-xs text-gray-400">Receive updates via email</div>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                    <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Push Notifications</div>
                    <div className="text-xs text-gray-400">Receive push notifications</div>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600">
                    <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white transition" />
                  </button>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="card p-md">
              <div className="flex items-center gap-3 mb-6">
                {darkMode ? <Moon className="w-5 h-5 text-blue-500" /> : <Sun className="w-5 h-5 text-blue-500" />}
                <h2 className="text-lg font-semibold">Appearance</h2>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Dark Mode</div>
                  <div className="text-xs text-gray-400">Toggle dark mode</div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${darkMode ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <span className={`${darkMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`} />
                </button>
              </div>
            </div>

            {/* Language */}
            <div className="card p-md">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Language</h2>
              </div>
              <select className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>English (South Africa)</option>
                <option>Afrikaans</option>
                <option>Zulu</option>
                <option>Xhosa</option>
              </select>
            </div>

            {/* Security */}
            <div className="card p-md">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Security</h2>
              </div>
              <button className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors text-left">
                Change Password
              </button>
            </div>

            {/* Sign Out */}
            <div className="card p-md border-2 border-red-900/30">
              <div className="flex items-center gap-3 mb-6">
                <LogOut className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold">Sign Out</h2>
              </div>
              <p className="text-sm text-gray-400 mb-4">Sign out from your account on this device.</p>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-700 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:cursor-not-allowed shadow-lg hover:shadow-red-600/30"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
