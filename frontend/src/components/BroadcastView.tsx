import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import SendIcon from "@mui/icons-material/Send";
import { api } from "../api";

export const BroadcastView: React.FC = () => {
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBroadcast = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.broadcast(message);
      setResult(res);
      setMessage("");
    } catch (err: any) {
      setError(err?.message || "Broadcast failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Broadcast Center
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Broadcast announcements or marketing updates to all active customers in your database
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Broadcast completed successfully!
          <br />
          <b>Total Targets:</b> {result.total} &nbsp;|&nbsp; <b>Successfully Sent:</b> {result.sent} &nbsp;|&nbsp;{" "}
          <b>Failed:</b> {result.failed}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <CampaignIcon sx={{ fontSize: 32, color: "primary.main" }} />
            <div>
              <Typography variant="h6">Compose Broadcast Message</Typography>
              <Typography variant="body2" color="text.secondary">
                Plain text or formatted announcements sent via Telegram Bot API
              </Typography>
            </div>
          </Box>

          <TextField
            label="Announcement Message"
            fullWidth
            multiline
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your broadcast announcement here..."
            disabled={loading}
            sx={{ mb: 3 }}
          />

          <Alert severity="info" sx={{ mb: 3 }}>
            ⚠️ <b>Note:</b> The message will be dispatched directly to all non-banned users in your D1 database. Please
            verify your wording before publishing.
          </Alert>

          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            disabled={loading || !message.trim()}
            onClick={() => setConfirmOpen(true)}
          >
            {loading ? "Transmitting Broadcast..." : "Initiate Broadcast"}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs">
        <DialogTitle>Confirm Broadcast</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to broadcast this message to all registered customers? This action cannot be undone.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography
            variant="body2"
            sx={{
              p: 1.5,
              bgcolor: "rgba(255, 255, 255, 0.05)",
              borderRadius: 1,
              fontStyle: "italic",
            }}
          >
            {message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleBroadcast} variant="contained" color="primary">
            Confirm & Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
