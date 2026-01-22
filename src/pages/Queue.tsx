import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS_CONFIG, canAccessFeature } from '@/config/plans.config';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Send, Wand2, Lock, Loader2 } from 'lucide-react';

interface QueueItem {
  id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  public_jobs: {
    id: string;
    job_title: string;
    company: string;
    email: string;
    city: string;
    state: string;
  };
}

export default function Queue() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const planTier = profile?.plan_tier || 'free';
  const hasMagicPaste = canAccessFeature(planTier, 'magic_paste');

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    const { data, error } = await supabase
      .from('my_queue')
      .select(`
        id,
        status,
        sent_at,
        created_at,
        public_jobs (
          id,
          job_title,
          company,
          email,
          city,
          state
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching queue:', error);
      toast({
        title: 'Erro ao carregar fila',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setQueue((data as unknown as QueueItem[]) || []);
    }
    setLoading(false);
  };

  const removeFromQueue = async (id: string) => {
    const { error } = await supabase.from('my_queue').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setQueue(queue.filter((item) => item.id !== id));
      toast({
        title: 'Removido da fila',
        description: 'A vaga foi removida da sua fila.',
      });
    }
  };

  const sendEmails = async () => {
    setSending(true);

    // Simulate sending for demo purposes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: 'Emails enviados!',
      description: `${queue.filter((q) => q.status === 'pending').length} aplicações foram enviadas.`,
    });

    // Update queue status
    const pendingIds = queue.filter((q) => q.status === 'pending').map((q) => q.id);
    if (pendingIds.length > 0) {
      await supabase
        .from('my_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', pendingIds);
    }

    fetchQueue();
    setSending(false);
  };

  const pendingCount = queue.filter((q) => q.status === 'pending').length;
  const sentCount = queue.filter((q) => q.status === 'sent').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Minha Fila</h1>
          <p className="text-muted-foreground mt-1">
            {pendingCount} vagas pendentes • {sentCount} enviadas
          </p>
        </div>

        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                disabled={!hasMagicPaste}
                className={!hasMagicPaste ? 'opacity-50' : ''}
              >
                {hasMagicPaste ? (
                  <Wand2 className="h-4 w-4 mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Magic Paste (IA)
              </Button>
            </TooltipTrigger>
            {!hasMagicPaste && (
              <TooltipContent>
                <p>Exclusivo para plano Diamond</p>
              </TooltipContent>
            )}
          </Tooltip>

          <Button
            onClick={sendEmails}
            disabled={pendingCount === 0 || sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar ({pendingCount})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Na Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Enviados Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Limite Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{PLANS_CONFIG[planTier].limits.daily_emails}</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vagas na Fila</CardTitle>
          <CardDescription>
            Gerencie as vagas que você vai aplicar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando fila...
                  </TableCell>
                </TableRow>
              ) : queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Sua fila está vazia</p>
                      <Button variant="outline" onClick={() => (window.location.href = '/jobs')}>
                        Buscar Vagas
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.public_jobs.job_title}
                    </TableCell>
                    <TableCell>{item.public_jobs.company}</TableCell>
                    <TableCell>{item.public_jobs.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.status === 'sent' ? 'default' : 'secondary'}
                        className={
                          item.status === 'sent'
                            ? 'bg-success/10 text-success border-success/30'
                            : ''
                        }
                      >
                        {item.status === 'sent' ? 'Enviado' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeFromQueue(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
