import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, ListTodo, Diamond, Settings, LogOut, Users, AlertCircle, Brain, Lock } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile';
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
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function AppSidebar() {
  const { profile, user, smtpStatus, signOut } = useAuth();
  const { t } = useTranslation();
  const { state, setOpen, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const collapsed = state === 'collapsed';
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const needsSmtpSetup = smtpStatus && (!smtpStatus.hasPassword || !smtpStatus.hasRiskProfile);

  const isFreeUser = profile?.plan_tier === 'free' || !profile?.plan_tier;

  const menuItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { title: t('nav.jobs'), url: '/jobs', icon: Search },
    { title: t('nav.queue'), url: '/queue', icon: ListTodo },
    // Referrals only visible for free users
    ...(isFreeUser ? [{ title: t('nav.referrals'), url: '/referrals', icon: Users }] : []),
    { title: t('nav.plans'), url: '/plans', icon: Diamond },
    { title: t('nav.settings'), url: '/settings', icon: Settings, needsAttention: needsSmtpSetup },
  ];

  // Admin-only menu items
  const adminMenuItems = [
    { title: 'Uso de IA', url: '/admin/ai-usage', icon: Brain },
  ];

  // Close sidebar on mobile when clicking a link
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Desktop hover handlers with debounce for collapse
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (!isMobile) {
      // Clear any pending collapse
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
        collapseTimeoutRef.current = null;
      }
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      // Debounce collapse by 150ms to prevent accidental closing
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
              <div className="text-xs font-medium text-sidebar-foreground/70">{t('common.menu')}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t('common.menu')}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              <TooltipProvider>
                {menuItems.map((item) => {
                  const isSettings = item.url === '/settings';
                  const requiresAuth = isSettings;
                  
                  return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild={!requiresAuth || user} 
                      tooltip={item.title} 
                      className={cn(
                        collapsed && !isMobile && "justify-center"
                      )}
                      onClick={(e) => {
                        if (requiresAuth && !user) {
                          e.preventDefault();
                          setShowLoginDialog(true);
                          if (isMobile) setOpenMobile(false);
                        } else {
                          handleNavClick();
                        }
                      }}
                    >
                      {(!requiresAuth || user) ? (
                        <NavLink
                          to={item.url}
                          className={cn(
                            'flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative',
                            collapsed && !isMobile ? 'justify-center px-0' : 'w-full px-3 py-2.5'
                          )}
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        >
                          <div className="relative">
                            <item.icon className="h-5 w-5 shrink-0" />
                            {item.needsAttention && collapsed && !isMobile && (
                              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                            )}
                          </div>
                          {(!collapsed || isMobile) && (
                            <>
                              <span className="flex-1 truncate">{item.title}</span>
                              {item.needsAttention && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="flex items-center">
                                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right">
                                    <p>{t('smtp.configureRequired')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </NavLink>
                      ) : (
                        <div
                          className={cn(
                            'flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative cursor-pointer',
                            collapsed && !isMobile ? 'justify-center px-0' : 'w-full px-3 py-2.5'
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {(!collapsed || isMobile) && (
                            <span className="flex-1 truncate">{item.title}</span>
                          )}
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )})}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Menu */}
        {isAdmin && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Admin</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <TooltipProvider>
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        tooltip={item.title} 
                        className={cn(
                          collapsed && !isMobile && "justify-center"
                        )}
                      >
                        <NavLink
                          to={item.url}
                          onClick={handleNavClick}
                          className={cn(
                            'flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative',
                            collapsed && !isMobile ? 'justify-center px-0' : 'w-full px-3 py-2.5'
                          )}
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {(!collapsed || isMobile) && (
                            <span className="flex-1 truncate">{item.title}</span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </TooltipProvider>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          {(!collapsed || isMobile) && (
            <div className="text-sm text-muted-foreground truncate">
              {profile?.email}
            </div>
          )}

          <Button
            variant="ghost"
            size={collapsed && !isMobile ? 'icon' : 'sm'}
            onClick={() => {
              if (isMobile) setOpenMobile(false);
              signOut();
            }}
            className={cn(
              'text-muted-foreground hover:text-destructive',
              collapsed && !isMobile ? 'mx-auto' : 'justify-start'
            )}
            title={t('common.logout')}
            aria-label={t('common.logout')}
          >
            <LogOut className={cn('h-4 w-4', (!collapsed || isMobile) && 'mr-2')} />
            {(!collapsed || isMobile) && t('common.logout')}
          </Button>
        </div>
      </SidebarFooter>

      {/* Login Required Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Login necessário
            </DialogTitle>
            <DialogDescription>
              Para acessar as configurações da sua conta, você precisa estar logado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-sm text-foreground">
                ✨ Crie sua conta gratuitamente para gerenciar suas configurações e começar a enviar candidaturas!
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                className="w-full" 
                onClick={() => {
                  setShowLoginDialog(false);
                  navigate('/auth');
                  if (isMobile) setOpenMobile(false);
                }}
              >
                Fazer Login / Criar Conta
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowLoginDialog(false)}
              >
                Continuar Navegando
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
