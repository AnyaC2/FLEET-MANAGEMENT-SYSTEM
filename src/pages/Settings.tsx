import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { defaultSettings, saveUserSettings, loadUserSettings } from '@/lib/settings-data';
import type { AppSettings } from '@/types';

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setSettings(defaultSettings);
      return;
    }

    void (async () => {
      const saved = await loadUserSettings(user.id);
      setSettings(saved);
    })();
  }, [user]);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('You need to be logged in to save settings');
      return;
    }

    try {
      setIsSaving(true);
      const result = await saveUserSettings(user.id, settings);
      if (result.savedToBackend) {
        toast.success('Settings saved successfully');
      } else {
        toast.success('Settings saved locally');
      }
    } catch (error) {
      console.error('Failed to save settings at all', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="lfz-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-gray-900 sm:text-[2.25rem]">Settings</h1>
          <p className="mt-1.5 text-sm text-gray-500">Configure fleet management preferences and alerts.</p>
        </div>
        <Button onClick={() => void handleSave()} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Notifications */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 [&>div]:gap-4 [&>div]:py-4 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-500">Receive notification emails in your inbox</p>
            </div>
            <Switch
              aria-label="Email notifications"
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle('emailNotifications')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Maintenance Alerts</p>
              <p className="text-sm text-gray-500">Get notified about upcoming maintenance</p>
            </div>
            <Switch
              aria-label="Maintenance alerts"
              checked={settings.maintenanceAlerts}
              onCheckedChange={() => handleToggle('maintenanceAlerts')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Fuel Alerts</p>
              <p className="text-sm text-gray-500">Get notified about abnormal fuel consumption</p>
            </div>
            <Switch
              aria-label="Fuel alerts"
              checked={settings.fuelAlerts}
              onCheckedChange={() => handleToggle('fuelAlerts')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Incident Alerts</p>
              <p className="text-sm text-gray-500">Get notified when incidents are reported</p>
            </div>
            <Switch
              aria-label="Incident alerts"
              checked={settings.incidentAlerts}
              onCheckedChange={() => handleToggle('incidentAlerts')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Document Alerts</p>
              <p className="text-sm text-gray-500">Get notified when documents are expiring or expired</p>
            </div>
            <Switch
              aria-label="Document alerts"
              checked={settings.documentAlerts}
              onCheckedChange={() => handleToggle('documentAlerts')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">License Alerts</p>
              <p className="text-sm text-gray-500">Get notified when driver licenses are expiring or expired</p>
            </div>
            <Switch
              aria-label="Driver licence alerts"
              checked={settings.licenseAlerts}
              onCheckedChange={() => handleToggle('licenseAlerts')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
