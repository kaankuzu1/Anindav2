/**
 * Browser Notifications Service
 * 
 * Handles:
 * - Permission requests
 * - Push notifications for replies
 * - Sound alerts
 * - Tab badge count
 */

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
  playSound?: boolean;
}

// Check if browser supports notifications
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Get current permission state
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

// Show a browser notification
export function showNotification(options: NotificationOptions): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  const notification = new Notification(options.title, {
    body: options.body,
    icon: options.icon || '/logo.png',
    tag: options.tag,
    requireInteraction: false,
  });

  if (options.onClick) {
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  }

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);

  // Play sound if requested
  if (options.playSound) {
    playNotificationSound();
  }

  return notification;
}

// Play notification sound
let audioContext: AudioContext | null = null;

export function playNotificationSound(type: 'default' | 'urgent' = 'default'): void {
  try {
    // Create audio context lazily
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended (required after user interaction)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Create a simple notification beep
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure sound based on type
    if (type === 'urgent') {
      // Higher pitch, longer duration for urgent
      oscillator.frequency.value = 880; // A5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } else {
      // Gentle ping for default
      oscillator.frequency.value = 523.25; // C5
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.15);
    }
  } catch {
    // Silently fail if audio not available
  }
}

// Update tab badge (document title)
let originalTitle: string | null = null;
let currentBadgeCount = 0;

export function updateTabBadge(count: number): void {
  if (typeof document === 'undefined') return;

  // Store original title
  if (originalTitle === null) {
    originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
  }

  currentBadgeCount = count;

  if (count > 0) {
    document.title = `(${count}) ${originalTitle}`;
  } else {
    document.title = originalTitle;
  }
}

// Get current badge count
export function getTabBadgeCount(): number {
  return currentBadgeCount;
}

// Increment badge count
export function incrementTabBadge(): void {
  updateTabBadge(currentBadgeCount + 1);
}

// Clear badge
export function clearTabBadge(): void {
  updateTabBadge(0);
}

// High-intent reply notification
export function notifyInterestedReply(
  fromName: string,
  fromEmail: string,
  subject: string,
  replyId: string,
  onClick?: () => void
): void {
  showNotification({
    title: 'New Interested Lead!',
    body: `${fromName || fromEmail}: ${subject || 'New reply'}`,
    tag: `reply-${replyId}`,
    playSound: true,
    onClick,
  });

  incrementTabBadge();
}

// Question reply notification
export function notifyQuestionReply(
  fromName: string,
  fromEmail: string,
  subject: string,
  replyId: string,
  onClick?: () => void
): void {
  showNotification({
    title: 'New Question',
    body: `${fromName || fromEmail}: ${subject || 'New reply'}`,
    tag: `reply-${replyId}`,
    playSound: false,
    onClick,
  });

  incrementTabBadge();
}

// Meeting request notification
export function notifyMeetingRequest(
  fromName: string,
  fromEmail: string,
  subject: string,
  replyId: string,
  onClick?: () => void
): void {
  showNotification({
    title: 'Meeting Request!',
    body: `${fromName || fromEmail} wants to schedule a meeting`,
    tag: `reply-${replyId}`,
    playSound: true,
    onClick,
  });

  // Play urgent sound for meeting requests
  playNotificationSound('urgent');
  
  incrementTabBadge();
}

// Generic new reply notification
export function notifyNewReply(
  intent: string | null,
  fromName: string | null,
  fromEmail: string,
  subject: string | null,
  replyId: string,
  onClick?: () => void
): void {
  const name = fromName || fromEmail;
  
  switch (intent) {
    case 'interested':
      notifyInterestedReply(name, fromEmail, subject || '', replyId, onClick);
      break;
    case 'meeting_request':
      notifyMeetingRequest(name, fromEmail, subject || '', replyId, onClick);
      break;
    case 'question':
      notifyQuestionReply(name, fromEmail, subject || '', replyId, onClick);
      break;
    default:
      // Only show notification for positive/neutral intents, not spam/bounce
      if (!['bounce', 'unsubscribe', 'spam_reported', 'out_of_office', 'auto_reply'].includes(intent || '')) {
        showNotification({
          title: 'New Reply',
          body: `${name}: ${subject || 'New reply'}`,
          tag: `reply-${replyId}`,
          playSound: false,
          onClick,
        });
        incrementTabBadge();
      }
  }
}
