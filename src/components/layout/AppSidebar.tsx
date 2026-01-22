import { LayoutDashboard, Search, ListTodo, Diamond, Settings, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG } from '@/config/plans.config';
import { cn } from '@/lib/utils';
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

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Buscar Vagas', url: '/jobs', icon: Search },
  { title: 'Minha Fila', url: '/queue', icon: ListTodo },
  { title: 'Planos', url: '/plans', icon: Diamond },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { profile, signOut } = useAuth();
  const planTier = profile?.plan_tier || 'free';
  const planConfig = PLANS_CONFIG[planTier];

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">H2</span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">H2B Sender</h1>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full border font-medium',
                getPlanBadgeClasses()
              )}
            >
              {planConfig.label}
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
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
