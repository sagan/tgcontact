import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { api, MessageMapItem } from "../api";

export const MessagesView: React.FC = () => {
  const [messages, setMessages] = useState<MessageMapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMessages(50);
      setMessages(res.messages);
    } catch (err: any) {
      setError(err?.message || "Failed to load mapped messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Message Relay Audit Log
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Recent bidirectional message correlations mapped between private user chats and supergroup topics
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Map ID</TableCell>
              <TableCell>Customer User ID</TableCell>
              <TableCell>User Chat Message ID</TableCell>
              <TableCell align="center">Relay Direction</TableCell>
              <TableCell>Group Chat Message ID</TableCell>
              <TableCell>Logged At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  No messages forwarded yet.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>#{m.id}</TableCell>
                  <TableCell>
                    <code>{m.user_id}</code>
                  </TableCell>
                  <TableCell>
                    <b>Msg #{m.user_chat_message_id}</b>
                  </TableCell>
                  <TableCell align="center">
                    <SwapHorizIcon sx={{ color: "secondary.main", verticalAlign: "middle" }} />
                  </TableCell>
                  <TableCell>
                    <b>Msg #{m.group_chat_message_id}</b>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(m.created_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
