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
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Configure your fleet management preferences</p>
        </div>
        <Button onClick={() => void handleSave()} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-500">Receive email updates about your fleet</p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle('emailNotifications')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-500">Receive browser notifications</p>
            </div>
            <Switch
              checked={settings.pushNotifications}
              onCheckedChange={() => handleToggle('pushNotifications')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Maintenance Alerts</p>
              <p className="text-sm text-gray-500">Get notified about upcoming maintenance</p>
            </div>
            <Switch
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
              checked={settings.licenseAlerts}
              onCheckedChange={() => handleToggle('licenseAlerts')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
