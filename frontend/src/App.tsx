import React, { useState } from "react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
  Container,
  Chip,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";

import { api } from "./api";
import { LoginView } from "./components/LoginView";
import { DashboardView } from "./components/DashboardView";
import { UsersView } from "./components/UsersView";
import { TopicsView } from "./components/TopicsView";
import { MessagesView } from "./components/MessagesView";
import { BroadcastView } from "./components/BroadcastView";
import { SettingsView } from "./components/SettingsView";
import { ConfigureDialog } from "./components/ConfigureDialog";

const DRAWER_WIDTH = 260;

export const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(api.isLoggedIn());
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  const handleLogout = () => {
    api.logout();
    setIsLoggedIn(false);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <DashboardOutlinedIcon /> },
    { id: "users", label: "User Directory", icon: <PeopleAltOutlinedIcon /> },
    { id: "topics", label: "Forum Topics", icon: <ForumOutlinedIcon /> },
    { id: "messages", label: "Message Relay Log", icon: <SwapHorizOutlinedIcon /> },
    { id: "broadcast", label: "Broadcast Center", icon: <CampaignOutlinedIcon /> },
    { id: "settings", label: "Bot Settings", icon: <SettingsOutlinedIcon /> },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          ml: `${DRAWER_WIDTH}px`,
          bgcolor: "rgba(11, 15, 25, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "none",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Cloudflare Edge Bot Administration
            </Typography>
            <Chip
              label="CF Workers + D1"
              size="small"
              sx={{ bgcolor: "rgba(99, 102, 241, 0.15)", color: "primary.light" }}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<TuneOutlinedIcon />}
              onClick={() => setConfigDialogOpen(true)}
            >
              Configure
            </Button>
            <IconButton onClick={handleLogout} color="error" title="Sign Out">
              <LogoutOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          },
        }}
      >
        <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 16px -4px rgba(99, 102, 241, 0.4)",
            }}
          >
            <SmartToyOutlinedIcon sx={{ color: "#fff" }} />
          </Box>
          <div>
            <Typography variant="subtitle1" fontWeight={700}>
              Tgcontact
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Serverless Control
            </Typography>
          </div>
        </Box>

        <List sx={{ px: 2 }}>
          {navItems.map((item) => {
            const isSelected = currentTab === item.id;
            return (
              <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => setCurrentTab(item.id)}
                  sx={{
                    borderRadius: 2,
                    py: 1.2,
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "#fff",
                      "&:hover": {
                        bgcolor: "primary.dark",
                      },
                      "& .MuiListItemIcon-root": {
                        color: "#fff",
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: isSelected ? "#fff" : "text.secondary" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: isSelected ? 600 : 500 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, p: 4, mt: 8 }}>
        <Container maxWidth="xl" disableGutters>
          {currentTab === "dashboard" && (
            <DashboardView
              key={refreshKey}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenConfigureModal={() => setConfigDialogOpen(true)}
            />
          )}
          {currentTab === "users" && <UsersView />}
          {currentTab === "topics" && <TopicsView />}
          {currentTab === "messages" && <MessagesView />}
          {currentTab === "broadcast" && <BroadcastView />}
          {currentTab === "settings" && <SettingsView />}
        </Container>
      </Box>

      {/* Configuration & Diagnostics Modal */}
      <ConfigureDialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onWebhookUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </Box>
  );
};
export default App;
