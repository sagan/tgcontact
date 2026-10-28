import React, { useState } from "react";
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
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

interface WebhookSetupDialogProps {
  open: boolean;
  onClose: () => void;
}

export const WebhookSetupDialog: React.FC<WebhookSetupDialogProps> = ({ open, onClose }) => {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const webhookUrl = `${origin}/webhook`;
  const curlExample = `curl -F "url=${webhookUrl}" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Cloudflare Worker Webhook Setup Guide</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          Telegram interacts with your Cloudflare Worker via Webhooks instead of long-polling. Follow the steps below to
          connect your bot:
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          Your worker is live at <b>{origin}</b>. Any incoming updates will be dispatched directly to your Bot logic on
          Cloudflare Edge.
        </Alert>

        <Typography variant="subtitle2" gutterBottom>
          1. Webhook Endpoint URL:
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
          <TextField fullWidth size="small" value={webhookUrl} InputProps={{ readOnly: true }} />
          <Tooltip title={copied ? "Copied!" : "Copy URL"}>
            <IconButton onClick={() => copyToClipboard(webhookUrl)} color="primary">
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          2. Register with Telegram API (via cURL or browser):
        </Typography>
        <Box sx={{ position: "relative", mb: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            value={curlExample}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem" },
            }}
          />
          <Box sx={{ position: "absolute", right: 8, top: 8 }}>
            <Tooltip title={copied ? "Copied!" : "Copy cURL"}>
              <IconButton size="small" onClick={() => copyToClipboard(curlExample)} color="primary">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary">
          Replace <code>&lt;YOUR_BOT_TOKEN&gt;</code> with your actual Telegram bot token from @BotFather.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
