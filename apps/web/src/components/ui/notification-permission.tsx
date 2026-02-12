'use client';

import { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestNotificationPermission,
  NotificationPermissionState 
} from '@/lib/notifications';

interface NotificationPermissionProps {
  onPermissionChange?: (permission: NotificationPermissionState) => void;
}

export function NotificationPermission({ onPermissionChange }: NotificationPermissionProps) {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    isNotificationSupported() ? getNotificationPermission() : 'unsupported'
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    onPermissionChange?.(result);
    setIsRequesting(false);
  };

  // Don't show if not supported or already decided
  if (permission === 'unsupported' || permission === 'granted' || permission === 'denied' || isDismissed) {
    return null;
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <BellRing className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-foreground">Enable Notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Get instant alerts when interested leads reply. Never miss an opportunity!
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isRequesting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Requesting...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  Enable Notifications
                </>
              )}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="px-4 py-2 text-muted-foreground text-sm hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-muted-foreground hover:text-foreground rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Compact version for sidebar/header
export function NotificationPermissionCompact({ onPermissionChange }: NotificationPermissionProps) {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    isNotificationSupported() ? getNotificationPermission() : 'unsupported'
  );

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    onPermissionChange?.(result);
  };

  if (permission === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <BellOff className="w-4 h-4" />
        <span>Notifications not supported</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <BellOff className="w-4 h-4" />
        <span>Notifications blocked</span>
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2 text-success text-sm">
        <Bell className="w-4 h-4" />
        <span>Notifications enabled</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleRequestPermission}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Bell className="w-4 h-4" />
      <span>Enable notifications</span>
    </button>
  );
}

// Status indicator for header
export function NotificationStatus() {
  const permission = isNotificationSupported() ? getNotificationPermission() : 'unsupported';

  if (permission === 'granted') {
    return (
      <div className="relative" title="Notifications enabled">
        <Bell className="w-5 h-5 text-muted-foreground" />
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full" />
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div title="Notifications blocked">
        <BellOff className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div title="Click to enable notifications">
      <Bell className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}

export default NotificationPermission;
