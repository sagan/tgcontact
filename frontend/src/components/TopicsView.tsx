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
  Chip,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import LockIcon from "@mui/icons-material/Lock";
import { api, TopicItem } from "../api";

export const TopicsView: React.FC = () => {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTopics();
      setTopics(res.topics);
    } catch (err: any) {
      setError(err?.message || "Failed to load forum topics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleToggleStatus = async (topic: TopicItem) => {
    const nextStatus = topic.status === "opened" ? "closed" : "opened";
    try {
      await api.toggleTopic(topic.message_thread_id, nextStatus);
      setTopics((prev) =>
        prev.map((t) => (t.message_thread_id === topic.message_thread_id ? { ...t, status: nextStatus } : t)),
      );
    } catch (err: any) {
      alert(`Action failed: ${err?.message || err}`);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Forum Topics Status
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track and control active and closed support conversations in the Supergroup
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
              <TableCell>Thread / Topic ID</TableCell>
              <TableCell>Admin Group Chat ID</TableCell>
              <TableCell>Current Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell align="right">Remote Override</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : topics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  No active or recorded forum topics yet.
                </TableCell>
              </TableRow>
            ) : (
              topics.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      Topic #{t.message_thread_id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <code>{t.chat_id}</code>
                  </TableCell>
                  <TableCell>
                    {t.status === "opened" ? (
                      <Chip label="Opened" size="small" color="success" />
                    ) : (
                      <Chip label="Closed" size="small" color="default" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(t.updated_at).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      color={t.status === "opened" ? "warning" : "success"}
                      startIcon={t.status === "opened" ? <LockIcon /> : <LockOpenIcon />}
                      onClick={() => handleToggleStatus(t)}
                    >
                      {t.status === "opened" ? "Close Conversation" : "Reopen Conversation"}
                    </Button>
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
