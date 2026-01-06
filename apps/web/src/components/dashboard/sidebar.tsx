'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Mail,
  Inbox,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Flame,
} from 'lucide-react';

interface SidebarProps {
  user: User;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Inboxes', href: '/inboxes', icon: Inbox },
  { name: 'Warm-up', href: '/warmup', icon: Flame },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Replies', href: '/replies', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#1a1d24] border-r border-gray-200 dark:border-[#2a2f3a] hidden lg:block">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-[#2a2f3a]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Aninda" width={32} height={32} className="w-8 h-8" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">Aninda</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-600 dark:text-[#9ca3b0] hover:bg-gray-100 dark:hover:bg-[#252a35] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-200 dark:border-[#2a2f3a] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-200 dark:bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600 dark:text-primary">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-[#6b7280]">Free Plan</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-[#9ca3b0] rounded-lg hover:bg-gray-100 dark:hover:bg-[#252a35] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
