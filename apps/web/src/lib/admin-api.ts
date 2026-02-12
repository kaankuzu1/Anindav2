const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api/v1`;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      message = await res.text().catch(() => message);
    }
    throw new Error(message);
  }

  return res.json();
}

// --- Types ---

export interface AdminInbox {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'smtp';
  status: 'active' | 'error' | 'disabled';
  status_reason: string | null;
  health_score: number;
  max_capacity: number;
  current_load: number;
  sent_today: number;
  sent_total: number;
  received_today: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalAdminInboxes: number;
  activeAdminInboxes: number;
  errorAdminInboxes: number;
  totalCapacity: number;
  totalLoad: number;
  networkUsersCount: number;
}

export interface NetworkUser {
  inbox_id: string;
  inbox_email: string;
  team_id: string;
  warmup_mode: string;
  current_day: number;
  phase: string;
  admin_inbox_email: string | null;
  admin_inbox_id: string | null;
}

// --- Auth ---

export async function adminLogin(username: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let message = 'Login failed';
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

// --- Dashboard ---

export function fetchDashboardStats(): Promise<DashboardStats> {
  return adminFetch('/admin/dashboard');
}

// --- Inboxes ---

export function fetchAdminInboxes(): Promise<AdminInbox[]> {
  return adminFetch('/admin/inboxes');
}

export function fetchAdminInbox(id: string): Promise<AdminInbox> {
  return adminFetch(`/admin/inboxes/${id}`);
}

export function updateAdminInbox(id: string, data: Partial<Pick<AdminInbox, 'max_capacity' | 'status'>>): Promise<AdminInbox> {
  return adminFetch(`/admin/inboxes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminInbox(id: string): Promise<void> {
  return adminFetch(`/admin/inboxes/${id}`, { method: 'DELETE' });
}

export function checkAdminInboxConnection(id: string): Promise<{ connected: boolean; message?: string }> {
  return adminFetch(`/admin/inboxes/${id}/check-connection`, { method: 'POST' });
}

// --- Users ---

export interface NetworkUserEnriched {
  inbox_id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'smtp';
  status: 'active' | 'error' | 'disabled';
  health_score: number;
  warmup_day: number;
  warmup_phase: string;
  sent_today: number;
  assignments: Array<{
    admin_inbox_id: string;
    admin_email: string | null;
    admin_status: string | null;
    admin_health_score: number | null;
  }>;
}

export function fetchNetworkUsers(): Promise<NetworkUserEnriched[]> {
  return adminFetch('/admin/users');
}

// --- Assignments ---

export interface AdminInboxAssignment {
  id: string;
  inbox_id: string;
  admin_inbox_id: string;
  assigned_at: string;
  inbox_email: string;
  inbox_provider: string;
  inbox_status: string;
  inbox_health_score: number;
  team_id: string;
}

export interface InboxAssignment {
  inbox_id: string;
  inboxes: {
    email: string;
    status: string;
    health_score: number;
  } | null;
}

export function fetchInboxAssignments(adminInboxId: string): Promise<InboxAssignment[]> {
  return adminFetch(`/admin/inboxes/${adminInboxId}`).then((data: any) => data.assignments || []);
}

export function fetchAdminInboxAssignments(adminInboxId: string): Promise<AdminInboxAssignment[]> {
  return adminFetch(`/admin/inboxes/${adminInboxId}/assignments`);
}

export function createAdminInboxAssignment(adminInboxId: string, userInboxId: string): Promise<AdminInboxAssignment> {
  return adminFetch(`/admin/inboxes/${adminInboxId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ inbox_id: userInboxId }),
  });
}

export function deleteAdminInboxAssignment(adminInboxId: string, assignmentId: string): Promise<void> {
  return adminFetch(`/admin/inboxes/${adminInboxId}/assignments/${assignmentId}`, {
    method: 'DELETE',
  });
}

// Legacy functions for backward compatibility
export function assignUserInbox(adminInboxId: string, userInboxId: string): Promise<void> {
  return createAdminInboxAssignment(adminInboxId, userInboxId).then(() => undefined);
}

export function unassignUserInbox(adminInboxId: string, assignmentId: string): Promise<void> {
  return deleteAdminInboxAssignment(adminInboxId, assignmentId);
}

// --- Dashboard Extended ---

export interface DashboardStatsExtended {
  adminInboxes: {
    total: number;
    active: number;
    error: number;
  };
  capacity: {
    total: number;
    used: number;
    available: number;
    utilizationPercent: number;
  };
  today: {
    sent: number;
    received: number;
  };
  networkUsers: number;
}

export function fetchDashboardStatsExtended(): Promise<DashboardStatsExtended> {
  return adminFetch('/admin/dashboard');
}

// --- Stats ---

export interface AdminInboxStats {
  inbox: {
    id: string;
    email: string;
    provider: string;
    status: string;
    health_score: number;
    max_capacity: number;
    current_load: number;
  };
  totals: {
    sent: number;
    received: number;
    assignments: number;
  };
  today: {
    sent: number;
    received: number;
  };
  history: Array<{
    date: string;
    sent: number;
    received: number;
    replied: number;
  }>;
}

export function fetchAdminInboxStats(adminInboxId: string): Promise<AdminInboxStats> {
  return adminFetch(`/admin/inboxes/${adminInboxId}/stats`);
}

// --- Inboxes with enhanced data ---

export interface AdminInboxWithAssignments extends AdminInbox {
  assignment_count: number;
  assignments?: InboxAssignment[];
}
