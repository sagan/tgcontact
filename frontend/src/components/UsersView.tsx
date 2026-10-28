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
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Pagination,
  Tooltip,
  Alert,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SendIcon from "@mui/icons-material/Send";
import StarIcon from "@mui/icons-material/Star";
import { api, UserItem } from "../api";
import { SendMessageDialog } from "./SendMessageDialog";

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send message dialog state
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getUsers(page, 15, search);
      setUsers(res.users);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleBan = async (user: UserItem) => {
    try {
      const willBan = !user.is_banned;
      await api.banUser(user.user_id, willBan);
      setUsers((prev) => prev.map((u) => (u.user_id === user.user_id ? { ...u, is_banned: willBan ? 1 : 0 } : u)));
    } catch (err: any) {
      alert(`Action failed: ${err?.message || err}`);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography variant="h4" gutterBottom>
            User Directory
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage customer records ({total} registered), topic thread routing, and access permissions
          </Typography>
        </div>

        <form onSubmit={handleSearchSubmit}>
          <TextField
            size="small"
            placeholder="Search by ID, name or @username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: 320 }}
          />
        </form>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Telegram User</TableCell>
              <TableCell>User ID</TableCell>
              <TableCell>Topic Thread ID</TableCell>
              <TableCell>Account Type</TableCell>
              <TableCell>Captcha Verified</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  No customer records found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <div>
                        <Typography variant="body2" fontWeight={600}>
                          {[user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown"}
                        </Typography>
                        {user.username && (
                          <Typography variant="caption" color="text.secondary">
                            @{user.username}
                          </Typography>
                        )}
                      </div>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <code>{user.user_id}</code>
                  </TableCell>
                  <TableCell>
                    {user.message_thread_id > 0 ? (
                      <Chip
                        label={`Topic #${user.message_thread_id}`}
                        size="small"
                        color="secondary"
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not Created Yet
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_premium ? (
                      <Chip
                        icon={<StarIcon sx={{ color: "#fbbf24 !important" }} />}
                        label="Premium"
                        size="small"
                        sx={{ bgcolor: "rgba(251, 191, 36, 0.15)", color: "#fbbf24" }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Standard
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_verified ? (
                      <Chip label="Verified" size="small" color="success" />
                    ) : (
                      <Chip label="Pending" size="small" variant="outlined" color="warning" />
                    )}
                  </TableCell>
                  <TableCell>
                    {user.is_banned ? (
                      <Chip label="Banned" size="small" color="error" />
                    ) : (
                      <Chip label="Active" size="small" color="success" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Send Direct Message">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          setSelectedUser(user);
                          setSendDialogOpen(true);
                        }}
                      >
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={user.is_banned ? "Unban User" : "Ban User"}>
                      <IconButton
                        size="small"
                        color={user.is_banned ? "success" : "error"}
                        onClick={() => handleToggleBan(user)}
                      >
                        {user.is_banned ? <CheckCircleIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Box>
      )}

      <SendMessageDialog
        open={sendDialogOpen}
        user={selectedUser}
        onClose={() => setSendDialogOpen(false)}
        onSuccess={() => {
          alert("Direct message delivered successfully!");
        }}
      />
    </Box>
  );
};
