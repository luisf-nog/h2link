import { LayoutDashboard, Search, ListTodo, Diamond, Settings, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
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

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const menuItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { title: t('nav.jobs'), url: '/jobs', icon: Search },
    { title: t('nav.queue'), url: '/queue', icon: ListTodo },
    { title: t('nav.plans'), url: '/plans', icon: Diamond },
    { title: t('nav.settings'), url: '/settings', icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <div className={cn('min-w-0', collapsed && 'hidden')}>
            <div className="text-xs font-medium text-sidebar-foreground/70">{t('common.menu')}</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel>{t('common.menu')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className={cn(collapsed && 'mx-auto')}>
                    <NavLink
                      to={item.url}
                      className={cn(
                        'flex items-center gap-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
                        collapsed ? 'h-8 w-8 justify-center' : 'w-full px-3 py-2.5'
                      )}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-2">
          {!collapsed && (
            <div className="text-sm text-muted-foreground truncate">
              {profile?.email}
            </div>
          )}

          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={signOut}
            className={cn(
              'text-muted-foreground hover:text-destructive',
              collapsed ? 'mx-auto' : 'justify-start'
            )}
            title={t('common.logout')}
            aria-label={t('common.logout')}
          >
            <LogOut className={cn('h-4 w-4', !collapsed && 'mr-2')} />
            {!collapsed && t('common.logout')}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
