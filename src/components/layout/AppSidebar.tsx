import { LayoutDashboard, Search, ListTodo, Diamond, Settings, LogOut, Users, AlertCircle } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function AppSidebar() {
  const { profile, smtpStatus, signOut } = useAuth();
  const { t } = useTranslation();
  const { state, setOpen, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const collapsed = state === 'collapsed';

  const needsSmtpSetup = smtpStatus && (!smtpStatus.hasPassword || !smtpStatus.hasRiskProfile);

  const menuItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { title: t('nav.jobs'), url: '/jobs', icon: Search },
    { title: t('nav.queue'), url: '/queue', icon: ListTodo },
    { title: t('nav.referrals'), url: '/referrals', icon: Users },
    { title: t('nav.plans'), url: '/plans', icon: Diamond },
    { title: t('nav.settings'), url: '/settings', icon: Settings, needsAttention: needsSmtpSetup },
  ];

  // Close sidebar on mobile when clicking a link
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Desktop hover handlers
  const handleMouseEnter = () => {
    if (!isMobile) {
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setOpen(false);
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
                {menuItems.map((item) => (
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
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
    </Sidebar>
  );
}
