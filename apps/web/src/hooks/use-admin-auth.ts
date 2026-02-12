'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/lib/admin-api';

const TOKEN_KEY = 'admin_token';

export function useAdminAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token: newToken } = await adminLogin(username, password);
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setIsAuthenticated(true);
    router.push('/admin');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setIsAuthenticated(false);
    router.push('/admin/login');
  }, [router]);

  return { token, isAuthenticated, loading, login, logout };
}
