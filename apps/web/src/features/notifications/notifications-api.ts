import { apiRequest } from '@/lib/api';

export interface NotificationEntry {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function listNotifications(): Promise<NotificationEntry[]> {
  return apiRequest<NotificationEntry[]>('/notifications');
}

export function markNotificationRead(id: string): Promise<NotificationEntry | null> {
  return apiRequest<NotificationEntry | null>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiRequest<void>('/notifications/read-all', { method: 'POST' });
}