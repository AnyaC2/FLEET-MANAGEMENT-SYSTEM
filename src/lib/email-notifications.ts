import type { Notification } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export async function queueNotificationEmail(notificationId: Notification['id']): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-notification-emails', {
      body: { notificationId },
    });

    if (error) {
      console.error('Notification email function returned an error payload.', {
        notificationId,
        data,
      });
      throw error;
    }
  } catch (error) {
    console.error('Failed to queue notification emails.', {
      notificationId,
      error,
    });
  }
}
