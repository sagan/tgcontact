import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { api, BotSettings } from "../api";

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<BotSettings>({
    TGC_WELCOME_MESSAGE: "",
    TGC_DISABLE_CAPTCHA: 0,
    TGC_MESSAGE_INTERVAL: "5",
    TGC_DELETE_TOPIC_AS_FOREVER_BAN: 0,
    TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getSettings();
      setSettings(res.settings);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      await api.saveSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Bot Configuration
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Dynamically tune bot operational parameters without redeploying Cloudflare Workers
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {savedSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings updated successfully! Changes take effect immediately at the edge.
        </Alert>
      )}

      <form onSubmit={handleSave}>
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>
              Customer Onboarding & Greetings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Message presented to non-admin customers when they send /start
            </Typography>

            <TextField
              label="Welcome Message"
              fullWidth
              multiline
              rows={4}
              value={settings.TGC_WELCOME_MESSAGE}
              onChange={(e) => setSettings({ ...settings, TGC_WELCOME_MESSAGE: e.target.value })}
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Anti-Spam & Human Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Control captcha challenge requirements and rate limiting
            </Typography>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.TGC_DISABLE_CAPTCHA === 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        TGC_DISABLE_CAPTCHA: e.target.checked ? 1 : 0,
                      })
                    }
                  />
                }
                label="Disable Human Captcha Challenge"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                When enabled, new users do not need to identify matching text from captcha images.
              </Typography>
            </Box>

            <TextField
              label="Message Interval Throttling (Seconds)"
              type="number"
              fullWidth
              value={settings.TGC_MESSAGE_INTERVAL}
              onChange={(e) => setSettings({ ...settings, TGC_MESSAGE_INTERVAL: e.target.value })}
              helperText="Minimum wait time between consecutive messages from the same customer (0 to disable)."
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Topic & Moderation Policies
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Behavior on topic deletion and /clear commands
            </Typography>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.TGC_DELETE_TOPIC_AS_FOREVER_BAN === 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        TGC_DELETE_TOPIC_AS_FOREVER_BAN: e.target.checked ? 1 : 0,
                      })
                    }
                  />
                }
                label="Treat Deleted Forum Topic as Permanent Ban"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                If true, when a topic is deleted in the admin group, the customer is permanently banned from starting
                new topics.
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD === 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD: e.target.checked ? 1 : 0,
                      })
                    }
                  />
                }
                label="Delete User Chat Messages on /clear Command"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                When an admin executes /clear inside a forum topic, delete all conversation messages in the customer's
                private chat as well.
              </Typography>
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              disabled={saving}
            >
              {saving ? "Saving Changes..." : "Save Configuration"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </Box>
  );
};
