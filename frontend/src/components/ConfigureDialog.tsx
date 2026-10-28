import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import CloseIcon from "@mui/icons-material/Close";

import { api, ConfigStatusResponse, TestConfigResponse } from "../api";

interface ConfigureDialogProps {
  open: boolean;
  onClose: () => void;
  onWebhookUpdated?: () => void;
}

export const ConfigureDialog: React.FC<ConfigureDialogProps> = ({ open, onClose, onWebhookUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ConfigStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookSuccess, setWebhookSuccess] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConfigResponse["results"] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const origin = window.location.origin;
  const targetWebhookUrl = `${origin}/webhook`;

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getConfigStatus();
      setConfig(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load configuration status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setWebhookSuccess(null);
      setWebhookError(null);
      setTestResult(null);
      setTestError(null);
      fetchStatus();
    }
  }, [open]);

  const handleSetWebhook = async () => {
    try {
      setSettingWebhook(true);
      setWebhookSuccess(null);
      setWebhookError(null);
      const res = await api.configureWebhook(origin);
      setWebhookSuccess(res.message || `Webhook and bot menu commands set successfully!`);
      await fetchStatus();
      if (onWebhookUpdated) {
        onWebhookUpdated();
      }
    } catch (err: any) {
      setWebhookError(err?.message || "Failed to set webhook");
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestError(null);
      setTestResult(null);
      const res = await api.testTelegramConfig();
      setTestResult(res.results);
    } catch (err: any) {
      setTestError(err?.message || "Failed to test Telegram configuration");
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const envVars = config?.env
    ? [
        {
          name: "TGC_BOT_TOKEN",
          required: true,
          status: config.env.TGC_BOT_TOKEN,
          description: "Telegram Bot API token from @BotFather",
          extra: config.botInfo ? `@${config.botInfo.username}` : undefined,
        },
        {
          name: "TGC_ADMIN_GROUP_ID",
          required: true,
          status: config.env.TGC_ADMIN_GROUP_ID,
          description: "Telegram Supergroup ID where support topics are created",
          extra: config.env.TGC_ADMIN_GROUP_ID.value,
        },
        {
          name: "TGC_ADMIN_USER_IDS",
          required: true,
          status: config.env.TGC_ADMIN_USER_IDS,
          description: "Telegram User IDs of bot administrators (comma separated)",
          extra: config.env.TGC_ADMIN_USER_IDS.value
            ? `${config.env.TGC_ADMIN_USER_IDS.count} user(s): ${config.env.TGC_ADMIN_USER_IDS.value}`
            : undefined,
        },
        {
          name: "TGC_USERNAME",
          required: true,
          status: config.env.TGC_USERNAME,
          description: "Admin Web UI login username",
          extra: config.env.TGC_USERNAME.value,
        },
        {
          name: "TGC_PASSWORD",
          required: true,
          status: config.env.TGC_PASSWORD,
          description: "Admin Web UI login password",
        },
        {
          name: "TGC_WEBHOOK_SECRET",
          required: false,
          status: config.env.TGC_WEBHOOK_SECRET,
          description: "Webhook verification secret (auto-fallbacks to SHA-256 of password)",
          extra: config.env.TGC_WEBHOOK_SECRET.isSet ? "Custom Secret Set" : "Using sha256(TGC_PASSWORD)",
        },
      ]
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <TuneOutlinedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            Worker & Telegram Configuration
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {loading && !config ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* 1. Basic Environment Variables Status */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <div>
                  <Typography variant="subtitle1" fontWeight={600}>
                    1. Environment Variables Status
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Verification of required and optional parameters configured in wrangler.toml or Worker environment
                  </Typography>
                </div>
                <Tooltip title="Refresh Status">
                  <IconButton size="small" onClick={fetchStatus} disabled={loading}>
                    <RefreshOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: "background.paper" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Variable</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {envVars.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem" }}>
                          {item.name}
                          {item.required && (
                            <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
                              *
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.status.isSet ? (
                            <Chip
                              icon={<CheckCircleOutlineIcon />}
                              label="Configured"
                              color="success"
                              size="small"
                              variant="outlined"
                            />
                          ) : item.required ? (
                            <Chip
                              icon={<ErrorOutlineIcon />}
                              label="Missing"
                              color="error"
                              size="small"
                              variant="outlined"
                            />
                          ) : (
                            <Chip
                              icon={<WarningAmberOutlinedIcon />}
                              label="Optional / Fallback"
                              color="info"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.extra ? <b>{item.extra}</b> : item.description}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {config?.adminGroupCheck && (
                <Box
                  sx={{
                    mt: 2.5,
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Admin Support Group Configuration Check
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {config.adminGroupCheck.title || `Chat ID: ${config.adminGroupCheck.groupId}`}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap" }}>
                      <Chip
                        icon={config.adminGroupCheck.isSupergroup ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                        label={config.adminGroupCheck.isSupergroup ? "Supergroup" : `Type: ${config.adminGroupCheck.type || "group"}`}
                        color={config.adminGroupCheck.isSupergroup ? "success" : "error"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        icon={config.adminGroupCheck.isForum ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                        label={config.adminGroupCheck.isForum ? "Forum Topics Enabled" : "Topics Disabled"}
                        color={config.adminGroupCheck.isForum ? "success" : "error"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        icon={config.adminGroupCheck.botIsAdmin ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                        label={config.adminGroupCheck.botIsAdmin ? "Bot: Administrator" : "Bot: Not Admin"}
                        color={config.adminGroupCheck.botIsAdmin ? "success" : "error"}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        icon={config.adminGroupCheck.canManageTopics ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                        label={config.adminGroupCheck.canManageTopics ? "Manage Topics: Yes" : "Manage Topics: Missing"}
                        color={config.adminGroupCheck.canManageTopics ? "success" : "error"}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>

                  {config.adminGroupCheck.issues && config.adminGroupCheck.issues.length > 0 ? (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Action needed for admin support group:
                      </Typography>
                      {config.adminGroupCheck.issues.map((issue, idx) => (
                        <Typography key={idx} variant="caption" display="block">
                          • {issue}
                        </Typography>
                      ))}
                    </Alert>
                  ) : (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      All Support Group Requirements Met: Supergroup with Topics enabled and Bot is an Administrator with topic management permissions.
                    </Alert>
                  )}
                </Box>
              )}
            </Box>

            <Divider />

            {/* 2. Webhook Preview & Set Webhook */}
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                2. Telegram Webhook Endpoint
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configure Telegram to push updates directly to this Cloudflare Worker endpoint with secret token validation. Setting the webhook also automatically registers bot commands (<code>/start</code>, <code>/info</code>, <code>/clear</code>, <code>/broadcast</code>) as Telegram menu buttons.
              </Typography>

              {webhookSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {webhookSuccess}
                </Alert>
              )}
              {webhookError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {webhookError}
                </Alert>
              )}

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Current Origin Webhook URL"
                    value={targetWebhookUrl}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem" },
                    }}
                  />
                  <Tooltip title={copied ? "Copied!" : "Copy Webhook URL"}>
                    <IconButton onClick={() => copyToClipboard(targetWebhookUrl)} color="primary">
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={settingWebhook ? <CircularProgress size={16} color="inherit" /> : <LinkOutlinedIcon />}
                    onClick={handleSetWebhook}
                    disabled={settingWebhook || !config?.env?.TGC_BOT_TOKEN?.isSet}
                    sx={{ whiteSpace: "nowrap", minWidth: 150 }}
                  >
                    {settingWebhook ? "Setting..." : "Set Webhook"}
                  </Button>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Active Telegram Webhook:
                  </Typography>
                  {config?.webhookInfo?.url ? (
                    <Chip
                      icon={<CheckCircleOutlineIcon />}
                      label={config.webhookInfo.url}
                      color={config.webhookInfo.url === targetWebhookUrl ? "success" : "warning"}
                      size="small"
                      variant="outlined"
                    />
                  ) : (
                    <Chip
                      icon={<ErrorOutlineIcon />}
                      label="Webhook Not Set on Telegram"
                      color="warning"
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                {config?.webhookInfo?.lastErrorMessage && (
                  <Alert
                    severity="warning"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={handleSetWebhook}
                        disabled={settingWebhook}
                      >
                        Reset / Retry
                      </Button>
                    }
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        Telegram Webhook Delivery Notice:
                      </Typography>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem", my: 0.5 }}>
                        {config.webhookInfo.lastErrorMessage}
                      </Typography>
                      {config.webhookInfo.lastErrorDate && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Last recorded by Telegram: {new Date(config.webhookInfo.lastErrorDate * 1000).toLocaleString()}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Note: Telegram retains the last reported error in its diagnostics. If commands like <code>/info</code> are responding, live webhook delivery is operating normally. Click "Reset / Retry" to purge any old pending update retries on Telegram's side.
                      </Typography>
                    </Box>
                  </Alert>
                )}
              </Box>
            </Box>

            <Divider />

            {/* 3. Telegram Configuration Test */}
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <div>
                  <Typography variant="subtitle1" fontWeight={600}>
                    3. Connection & Configuration Test
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Validate bot credentials, supergroup topic accessibility, and send a live test message to configured admin Telegram account(s).
                  </Typography>
                </div>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={testing ? <CircularProgress size={16} color="inherit" /> : <PlayArrowOutlinedIcon />}
                  onClick={handleTest}
                  disabled={testing || !config?.env?.TGC_BOT_TOKEN?.isSet}
                >
                  {testing ? "Testing..." : "Test"}
                </Button>
              </Box>

              {testError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {testError}
                </Alert>
              )}

              {testResult && (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
                  <Alert
                    severity={testResult.adminUsers?.delivered && testResult.adminUsers.delivered > 0 ? "success" : "warning"}
                    sx={{ mb: 2 }}
                  >
                    {testResult.summary}
                  </Alert>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">
                        Bot Verification:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {testResult.botVerified && testResult.bot
                          ? `✅ Verified (@${testResult.bot.username}, ID: ${testResult.bot.id})`
                          : "❌ Failed"}
                      </Typography>
                    </Box>

                    <Divider />

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                          Admin Supergroup & Topics:
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {testResult.adminGroup?.title
                            ? testResult.adminGroup.title
                            : testResult.adminGroup?.error
                            ? `⚠️ ${testResult.adminGroup.error}`
                            : "Not Checked"}
                        </Typography>
                      </Box>

                      {testResult.adminGroup && testResult.adminGroup.checked && (
                        <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", mt: 0.5 }}>
                          <Chip
                            icon={testResult.adminGroup.isSupergroup ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                            label={testResult.adminGroup.isSupergroup ? "Supergroup" : `Type: ${testResult.adminGroup.type || "group"}`}
                            color={testResult.adminGroup.isSupergroup ? "success" : "error"}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            icon={testResult.adminGroup.isForum ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                            label={testResult.adminGroup.isForum ? "Forum Topics Enabled" : "Topics Disabled"}
                            color={testResult.adminGroup.isForum ? "success" : "error"}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            icon={testResult.adminGroup.botIsAdmin ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                            label={testResult.adminGroup.botIsAdmin ? "Bot: Administrator" : "Bot: Not Admin"}
                            color={testResult.adminGroup.botIsAdmin ? "success" : "error"}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            icon={testResult.adminGroup.canManageTopics ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                            label={testResult.adminGroup.canManageTopics ? "Manage Topics: Yes" : "Manage Topics: Missing"}
                            color={testResult.adminGroup.canManageTopics ? "success" : "error"}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      {testResult.adminGroup?.issues && testResult.adminGroup.issues.length > 0 && (
                        <Box sx={{ mt: 1, p: 1.5, bgcolor: "rgba(245, 158, 11, 0.1)", borderRadius: 1, border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                          <Typography variant="caption" fontWeight={600} color="warning.main" display="block" gutterBottom>
                            ⚠️ Group Configuration Issues Detected:
                          </Typography>
                          {testResult.adminGroup.issues.map((issue, idx) => (
                            <Typography key={idx} variant="caption" display="block" color="text.secondary">
                              • {issue}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>

                    <Divider />

                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">
                        Admin Test Direct Message:
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {testResult.adminUsers?.delivered && testResult.adminUsers.delivered > 0
                          ? `✅ Delivered (${testResult.adminUsers.delivered}/${testResult.adminUsers.attempted})`
                          : testResult.adminUsers?.error
                          ? `⚠️ ${testResult.adminUsers.error}`
                          : "Not Configured"}
                      </Typography>
                    </Box>

                    {testResult.adminUsers?.details && testResult.adminUsers.details.length > 0 && (
                      <Box sx={{ mt: 1, pl: 1, borderLeft: "2px solid rgba(255, 255, 255, 0.12)" }}>
                        {testResult.adminUsers.details.map((d, idx) => (
                          <Typography key={idx} variant="caption" display="block" color="text.secondary">
                            • {d}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
