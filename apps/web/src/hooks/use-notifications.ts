'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  notifyNewReply,
  updateTabBadge,
  clearTabBadge,
  NotificationPermissionState,
} from '@/lib/notifications';

interface Reply {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  intent: string | null;
  is_read: boolean;
}

interface UseNotificationsOptions {
  teamId?: string;
  enabled?: boolean;
  onNewReply?: (reply: Reply) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { teamId, enabled = true, onNewReply } = options;
  const router = useRouter();
  const supabase = createClient();
  
  const [permission, setPermission] = useState<NotificationPermissionState>('default');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subscriptionRef = useRef<any>(null);

  // Check initial permission
  useEffect(() => {
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    } else {
      setPermission('unsupported');
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!teamId) return;

    const { count } = await supabase
      .from('replies')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('is_read', false)
      .eq('is_archived', false);

    const newCount = count ?? 0;
    setUnreadCount(newCount);
    updateTabBadge(newCount);
  }, [supabase, teamId]);

  // Handle new reply
  const handleNewReply = useCallback((reply: Reply) => {
    // Call custom handler
    onNewReply?.(reply);

    // Show notification if permitted
    if (permission === 'granted') {
      notifyNewReply(
        reply.intent,
        reply.from_name,
        reply.from_email,
        reply.subject,
        reply.id,
        () => {
          router.push(`/unibox?selected=${reply.id}`);
        }
      );
    }

    // Update unread count
    if (!reply.is_read) {
      setUnreadCount((prev) => {
        const newCount = prev + 1;
        updateTabBadge(newCount);
        return newCount;
      });
    }
  }, [permission, router, onNewReply]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!enabled || !teamId) return;

    // Fetch initial count
    fetchUnreadCount();

    // Subscribe to new replies
    const channel = supabase
      .channel(`replies:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'replies',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const newReply = payload.new as Reply;
          handleNewReply(newReply);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'replies',
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const updatedReply = payload.new as Reply;
          const oldReply = payload.old as Reply;

          // If marked as read, decrement count
          if (!oldReply.is_read && updatedReply.is_read) {
            setUnreadCount((prev) => {
              const newCount = Math.max(0, prev - 1);
              updateTabBadge(newCount);
              return newCount;
            });
          }
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [enabled, teamId, supabase, fetchUnreadCount, handleNewReply]);

  // Clear badge when window gets focus (user is viewing the app)
  useEffect(() => {
    const handleFocus = () => {
      // Don't clear immediately, let the user see the count
      // The count will be updated as they read messages
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh count when tab becomes visible
        fetchUnreadCount();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUnreadCount]);

  // Mark reply as read (and update count)
  const markAsRead = useCallback(async (replyId: string) => {
    await (supabase
      .from('replies') as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', replyId);

    setUnreadCount((prev) => {
      const newCount = Math.max(0, prev - 1);
      updateTabBadge(newCount);
      return newCount;
    });
  }, [supabase]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setUnreadCount(0);
    clearTabBadge();
  }, []);

  return {
    permission,
    requestPermission,
    unreadCount,
    isSubscribed,
    markAsRead,
    clearAll,
    refreshCount: fetchUnreadCount,
    isSupported: isNotificationSupported(),
  };
}

export default useNotifications;
