'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import {
  LayoutDashboard,
  Inbox,
  Users,
  LogOut,
  Shield,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Inboxes', href: '/admin/inboxes', icon: Inbox },
  { name: 'Users', href: '/admin/users', icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-[#2a2f3a]">
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-orange-500" />
          <span className="text-xl font-bold text-gray-900 dark:text-white">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 dark:text-[#9ca3b0] hover:bg-gray-100 dark:hover:bg-[#252a35] hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-[#2a2f3a] p-4">
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#9ca3b0] rounded-lg hover:bg-gray-100 dark:hover:bg-[#252a35] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 bg-white dark:bg-[#1a1d24] border border-gray-200 dark:border-[#2a2f3a] rounded-lg shadow-lg"
        >
          {mobileOpen ? (
            <X className="w-5 h-5 text-gray-600 dark:text-white" />
          ) : (
            <Menu className="w-5 h-5 text-gray-600 dark:text-white" />
          )}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#1a1d24] border-r border-gray-200 dark:border-[#2a2f3a] transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#1a1d24] border-r border-gray-200 dark:border-[#2a2f3a] hidden lg:block">
        <div className="flex flex-col h-full">
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
