import { LayoutDashboard, Search, ListTodo, Diamond, Settings, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG } from '@/config/plans.config';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const { t } = useTranslation();
  const planTier = profile?.plan_tier || 'free';
  const planConfig = PLANS_CONFIG[planTier];

  const menuItems = [
    { title: t('nav.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { title: t('nav.jobs'), url: '/jobs', icon: Search },
    { title: t('nav.queue'), url: '/queue', icon: ListTodo },
    { title: t('nav.plans'), url: '/plans', icon: Diamond },
    { title: t('nav.settings'), url: '/settings', icon: Settings },
  ];

  const getPlanBadgeClasses = () => {
    switch (planConfig.color) {
      case 'blue':
        return 'bg-plan-gold/10 text-plan-gold border-plan-gold/30';
      case 'violet':
        return 'bg-plan-diamond/10 text-plan-diamond border-plan-diamond/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <BrandLogo height={40} className="shrink-0" />
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">{t('app.name')}</h1>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full border font-medium',
                getPlanBadgeClasses()
              )}
            >
              {t(`plans.tiers.${planTier}.label`)}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
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
          <div className="text-sm text-muted-foreground truncate">
            {profile?.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="justify-start text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('common.logout')}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
