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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
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
      className="border-r border-sidebar-border bg-sidebar" // Garante a cor de fundo do tema
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader className="p-3 border-b border-sidebar-border/50">
        {!collapsed && (
          <div className="text-xs font-bold text-sidebar-foreground/90 uppercase tracking-wider px-3">
            {t("common.menu")}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {menuItems.map((item) => {
                  const requiresAuth = item.url === "/settings" || item.url === "/queue" || item.url === "/referrals";
                  const isLocked = requiresAuth && !user;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild={!item.comingSoon && !isLocked}
                        tooltip={item.comingSoon ? `${item.title} (Em breve)` : item.title}
                        className={cn(
                          "transition-all duration-200",
                          collapsed && !isMobile && "justify-center",
                          item.comingSoon && "opacity-50 cursor-not-allowed hover:bg-transparent",
                        )}
                        onClick={(e) => {
                          if (item.comingSoon) {
                            e.preventDefault();
                            return;
                          }
                          if (isLocked) {
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
                              "flex items-center gap-3 rounded-lg text-sidebar-foreground/70 px-3 py-2.5 w-full",
                              collapsed && !isMobile && "justify-center px-0",
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0 opacity-70" />
                            {(!collapsed || isMobile) && (
                              <div className="flex items-center justify-between flex-1 min-w-0">
                                <span className="truncate">{item.title}</span>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-4 border-sidebar-foreground/30 text-sidebar-foreground/50"
                                >
                                  Soon
                                </Badge>
                              </div>
                            )}
                          </div>
                        ) : isLocked ? (
                          <div
                            className={cn(
                              "flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/50 cursor-pointer px-3 py-2.5 w-full group",
                              collapsed && !isMobile && "justify-center px-0",
                            )}
                          >
                            <div className="relative">
                              <item.icon className="h-5 w-5 shrink-0 text-sidebar-foreground/60 group-hover:text-sidebar-foreground" />
                              <Lock className="absolute -top-1.5 -right-1.5 h-3 w-3 text-amber-400 fill-amber-400" />
                            </div>
                            {(!collapsed || isMobile) && (
                              <span className="flex-1 truncate text-sidebar-foreground/80 group-hover:text-sidebar-foreground">
                                {item.title}
                              </span>
                            )}
                          </div>
                        ) : (
                          <NavLink
                            to={item.url}
                            className={cn(
                              "flex items-center gap-3 rounded-lg text-sidebar-foreground/90 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative w-full px-3 py-2.5",
                              collapsed && !isMobile && "justify-center px-0",
                            )}
                            activeClassName="bg-sidebar-accent text-white shadow-sm font-semibold"
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {(!collapsed || isMobile) && (
                              <div className="flex items-center justify-between flex-1">
                                <span className="truncate">{item.title}</span>
                                {item.needsAttention && (
                                  <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
                                )}
                              </div>
                            )}
                          </NavLink>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="mt-4 border-t border-sidebar-border/30 pt-4">
            {!collapsed && (
              <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold px-3">
                ADMIN PANEL
              </SidebarGroupLabel>
            )}
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
                          "flex items-center gap-3 rounded-lg text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent transition-colors relative px-3 py-2.5",
                          collapsed && !isMobile ? "justify-center px-0" : "w-full",
                        )}
                        activeClassName="bg-sidebar-accent text-white font-bold"
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

      <SidebarFooter className="p-4 border-t border-sidebar-border/50 bg-sidebar-accent/10">
        <div className="flex flex-col gap-3">
          {(!collapsed || isMobile) && (
            <div className="text-xs font-medium text-sidebar-foreground/60 truncate px-2">{profile?.email}</div>
          )}
          <Button
            variant="ghost"
            size={collapsed && !isMobile ? "icon" : "sm"}
            onClick={signOut}
            className={cn(
              "text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all",
              collapsed && !isMobile ? "mx-auto" : "justify-start px-2",
            )}
          >
            <LogOut className={cn("h-4 w-4", (!collapsed || isMobile) && "mr-2")} />
            {(!collapsed || isMobile) && <span className="font-medium">{t("common.logout")}</span>}
          </Button>
        </div>
      </SidebarFooter>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Lock className="h-5 w-5 text-amber-500 fill-amber-500" />
              {t("loginDialog.title")}
            </DialogTitle>
            <DialogDescription className="text-slate-600">{t("loginDialog.descriptionGeneric")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm text-slate-700 leading-relaxed">{t("loginDialog.benefit")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-11"
                onClick={() => {
                  setShowLoginDialog(false);
                  navigate("/auth");
                  if (isMobile) setOpenMobile(false);
                }}
              >
                {t("loginDialog.ctaLogin")}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-900"
                onClick={() => setShowLoginDialog(false)}
              >
                {t("loginDialog.ctaContinue")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
