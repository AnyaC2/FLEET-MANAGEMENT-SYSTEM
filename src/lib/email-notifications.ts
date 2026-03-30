import type { Notification } from '@/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export async function queueNotificationEmail(notificationId: Notification['id']): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  try {
    const { error } = await supabase.functions.invoke('send-notification-emails', {
      body: { notificationId },
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Failed to queue notification emails.', error);
  }
}
