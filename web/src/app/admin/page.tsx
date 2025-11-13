'use client';

import SuperAdminDashboard from '@/components/admin/SuperAdminDashboard';
import Link from 'next/link';
import { Settings, BookMarked, Activity, Users } from 'lucide-react';

const adminTools = [
  {
    title: 'AI Provider Configuration',
    description: 'Configure AI providers (Claude/OpenAI) and models per scenario and user tier',
    icon: Settings,
    href: '/admin/ai-config',
    color: 'bg-blue-500',
  },
  {
    title: 'CAPS Curriculum Mapping',
    description: 'Map CAPS topics to textbooks and chapters for exam generation',
    icon: BookMarked,
    href: '/admin/caps-mapping',
    color: 'bg-green-500',
  },
  {
    title: 'System Monitoring',
    description: 'View AI usage, costs, and system health metrics',
    icon: Activity,
    href: '/admin/monitoring',
    color: 'bg-purple-500',
    disabled: true,
  },
  {
    title: 'User Management',
    description: 'Manage users, organizations, and subscriptions',
    icon: Users,
    href: '/admin/users',
    color: 'bg-orange-500',
    disabled: true,
  },
];

export default function AdminDashboard() {
  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 min-h-screen">
      {/* Container wrapper for entire dashboard */}
      <div className="max-w-[1400px] mx-auto">
        {/* Main SuperAdmin Dashboard with live stats */}
        <SuperAdminDashboard />

        {/* Additional Admin Tools Section */}
        <div className="px-6 md:px-8 lg:px-12 pb-12">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-blue-600" />
              Admin Tools
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-400">
              System-wide settings and configurations
            </p>
          </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminTools.map((tool) => {
            const Icon = tool.icon;
            const isDisabled = tool.disabled;

            return (
              <Link
                key={tool.href}
                href={isDisabled ? '#' : tool.href}
                className={`group block bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 transition-all ${
                  isDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-600'
                }`}
                onClick={(e) => isDisabled && e.preventDefault()}
              >
                <div className="flex items-start gap-6">
                  <div
                    className={`${tool.color} p-4 rounded-2xl flex-shrink-0 shadow-lg ${
                      !isDisabled && 'group-hover:scale-110 transition-transform'
                    }`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      {tool.title}
                      {isDisabled && (
                        <span className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </h3>
                    <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      </div> {/* Close container wrapper */}
    </div>
  );
}
