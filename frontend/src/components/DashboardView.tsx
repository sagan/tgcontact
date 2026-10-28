import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { api, StatsResponse, BotInfoResponse } from "../api";

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenWebhookModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenWebhookModal }) => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, b] = await Promise.all([api.getStats(), api.getBotInfo()]);
      setStats(s);
      setBotInfo(b);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Dashboard Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Cloudflare Workers Edge Status & Real-time Bot Telemetry
          </Typography>
        </div>
        <Button variant="outlined" color="secondary" startIcon={<LinkOutlinedIcon />} onClick={onOpenWebhookModal}>
          Webhook Setup Guide
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(17, 24, 39, 0.8))",
              border: "1px solid rgba(99, 102, 241, 0.2)",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Customers
                  </Typography>
                  <Typography variant="h4">{stats?.totalUsers ?? 0}</Typography>
                </div>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(99, 102, 241, 0.2)",
                    color: "primary.light",
                  }}
                >
                  <PeopleAltOutlinedIcon />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: "linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(17, 24, 39, 0.8))",
              border: "1px solid rgba(6, 182, 212, 0.2)",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Topics
                  </Typography>
                  <Typography variant="h4">{stats?.openTopics ?? 0}</Typography>
                </div>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(6, 182, 212, 0.2)",
                    color: "secondary.light",
                  }}
                >
                  <ForumOutlinedIcon />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(17, 24, 39, 0.8))",
              border: "1px solid rgba(16, 185, 129, 0.2)",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Messages Mapped
                  </Typography>
                  <Typography variant="h4">{stats?.totalMessagesMapped ?? 0}</Typography>
                </div>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(16, 185, 129, 0.2)",
                    color: "success.light",
                  }}
                >
                  <SwapHorizOutlinedIcon />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(17, 24, 39, 0.8))",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Banned Users
                  </Typography>
                  <Typography variant="h4">{stats?.bannedUsers ?? 0}</Typography>
                </div>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(239, 68, 68, 0.2)",
                    color: "error.light",
                  }}
                >
                  <BlockOutlinedIcon />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bot & Support Group Health Status */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Telegram Bot & Support Group Health
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Connected Bot Credentials & Supergroup Topic Routing
              </Typography>

              {botInfo && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography color="text.secondary">Bot Identity:</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip
                        icon={<CheckCircleOutlineIcon />}
                        label={`@${botInfo.bot.username}`}
                        color="primary"
                        variant="outlined"
                      />
                      <Typography variant="body2">({botInfo.bot.firstName})</Typography>
                    </Box>
                  </Box>

                  <Divider />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography color="text.secondary">Admin Supergroup:</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {botInfo.adminGroupError ? (
                        <Chip icon={<ErrorOutlineIcon />} label="Admin Group Unreachable" color="error" />
                      ) : (
                        <Chip icon={<CheckCircleOutlineIcon />} label={botInfo.adminGroupTitle} color="success" />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        (ID: {botInfo.adminGroupId})
                      </Typography>
                    </Box>
                  </Box>

                  {botInfo.adminGroupError && (
                    <Alert severity="warning">
                      {botInfo.adminGroupError}. Please ensure the bot is added to the supergroup as an Admin with Topic
                      Management permissions.
                    </Alert>
                  )}

                  <Divider />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography color="text.secondary">Forum Topics Closed:</Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {stats?.closedTopics ?? 0}
                    </Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Quick Administration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Perform critical operations across your customer base
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  startIcon={<CampaignOutlinedIcon />}
                  onClick={() => onNavigate("broadcast")}
                >
                  Send Announcement Broadcast
                </Button>

                <Button
                  variant="outlined"
                  color="secondary"
                  fullWidth
                  startIcon={<ForumOutlinedIcon />}
                  onClick={() => onNavigate("topics")}
                >
                  Manage Support Topics
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<SettingsOutlinedIcon />}
                  onClick={() => onNavigate("settings")}
                >
                  Configure Bot Parameters
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
