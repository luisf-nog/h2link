import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  ListTodo,
  Diamond,
  Settings,
  LogOut,
  Users,
  AlertCircle,
  Brain,
  Lock,
  BarChart3,
  Upload,
  FileText,
  Sparkles,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge"; // Certifique-se de que este import existe
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AppSidebar() {
  const { profile, user, smtpStatus, signOut } = useAuth();
  const { t } = useTranslation();
  const { state, setOpen, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const needsSmtpSetup = smtpStatus && (!smtpStatus.hasPassword || !smtpStatus.hasRiskProfile);

  const isFreeUser = profile?.plan_tier === "free" || !profile?.plan_tier;

  const menuItems = [
    { title: t("nav.dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("nav.jobs"), url: "/jobs", icon: Search },
    { title: t("nav.queue"), url: "/queue", icon: ListTodo },
    ...(isFreeUser ? [{ title: t("nav.referrals"), url: "/referrals", icon: Users }] : []),
    { title: t("nav.plans"), url: "/plans", icon: Diamond },
    // ITEM ATUALIZADO: Coming Soon
    {
      title: "Resume AI",
      url: "/resume-converter",
      icon: FileText,
      comingSoon: true,
    },
    { title: t("nav.settings"), url: "/settings", icon: Settings, needsAttention: needsSmtpSetup },
  ];

  const adminMenuItems = [
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    { title: "Uso de IA", url: "/admin/ai-usage", icon: Brain },
    { title: "Import", url: "/admin/import", icon: Upload },
  ];

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (!isMobile) {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
        collapseTimeoutRef.current = null;
      }
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      collapseTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 150);
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-sidebar-foreground/70">{t("common.menu")}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t("common.menu")}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {menuItems.map((item) => {
                  const requiresAuth = item.url === "/settings" || item.url === "/queue" || item.url === "/referrals";

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild={!item.comingSoon && (!requiresAuth || !!user)}
                        tooltip={item.comingSoon ? `${item.title} (Coming Soon)` : item.title}
                        className={cn(
                          collapsed && !isMobile && "justify-center",
                          item.comingSoon && "opacity-60 cursor-not-allowed",
                        )}
                        onClick={(e) => {
                          if (item.comingSoon) {
                            e.preventDefault();
                            return;
                          }
                          if (requiresAuth && !user) {
                            e.preventDefault();
                            setShowLoginDialog(true);
                            if (isMobile) setOpenMobile(false);
                          } else {
                            handleNavClick();
                          }
                        }}
                      >
                        {item.comingSoon ? (
                          <div
                            className={cn(
                              "flex items-center gap-3 rounded-lg text-sidebar-foreground px-3 py-2.5 w-full",
                              collapsed && !isMobile && "justify-center px-0",
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {(!collapsed || isMobile) && (
                              <div className="flex items-center justify-between flex-1 min-w-0">
                                <span className="truncate">{item.title}</span>
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-none"
                                >
                                  Soon
                                </Badge>
                              </div>
                            )}
                          </div>
                        ) : !requiresAuth || user ? (
                          <NavLink
                            to={item.url}
                            className={cn(
                              "flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative",
                              collapsed && !isMobile ? "justify-center px-0" : "w-full px-3 py-2.5",
                            )}
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          >
                            <div className="relative flex items-center gap-3 w-full">
                              <item.icon className="h-5 w-5 shrink-0" />
                              {(!collapsed || isMobile) && <span className="flex-1 truncate">{item.title}</span>}
                              {item.needsAttention && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                            </div>
                          </NavLink>
                        ) : (
                          <div
                            className={cn(
                              "flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer px-3 py-2.5 w-full",
                              collapsed && !isMobile && "justify-center px-0",
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {(!collapsed || isMobile) && <span className="flex-1 truncate">{item.title}</span>}
                          </div>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu permanece igual */}
        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={cn(collapsed && !isMobile && "justify-center")}
                    >
                      <NavLink
                        to={item.url}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative",
                          collapsed && !isMobile ? "justify-center px-0" : "w-full px-3 py-2.5",
                        )}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {(!collapsed || isMobile) && <span className="flex-1 truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          {(!collapsed || isMobile) && <div className="text-sm text-muted-foreground truncate">{profile?.email}</div>}
          <Button
            variant="ghost"
            size={collapsed && !isMobile ? "icon" : "sm"}
            onClick={signOut}
            className={cn(
              "text-muted-foreground hover:text-destructive",
              collapsed && !isMobile ? "mx-auto" : "justify-start",
            )}
          >
            <LogOut className={cn("h-4 w-4", (!collapsed || isMobile) && "mr-2")} />
            {(!collapsed || isMobile) && t("common.logout")}
          </Button>
        </div>
      </SidebarFooter>

      {/* Login Dialog permanece igual */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {t("loginDialog.title")}
            </DialogTitle>
            <DialogDescription>{t("loginDialog.descriptionGeneric")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-sm text-foreground">{t("loginDialog.benefit")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  setShowLoginDialog(false);
                  navigate("/auth");
                  if (isMobile) setOpenMobile(false);
                }}
              >
                {t("loginDialog.ctaLogin")}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowLoginDialog(false)}>
                {t("loginDialog.ctaContinue")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
