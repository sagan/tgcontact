import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { api, UserItem } from "../api";

interface SendMessageDialogProps {
  open: boolean;
  user: UserItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const SendMessageDialog: React.FC<SendMessageDialogProps> = ({ open, user, onClose, onSuccess }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!user || !message.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await api.sendDirectMessage(user.user_id, message.trim());
      setMessage("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Send Direct Message to {user?.first_name || "User"} (ID: {user?.user_id})
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Message Text"
          fullWidth
          multiline
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message to deliver directly to the user's private Telegram chat..."
          disabled={loading}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          color="primary"
          endIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
          disabled={loading || !message.trim()}
        >
          Send Message
        </Button>
      </DialogActions>
    </Dialog>
  );
};
