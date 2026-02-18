
-- ================================================================
-- FIX 1: trigger_immediate_radar - adiciona filtro de max_experience
-- ================================================================
CREATE OR REPLACE FUNCTION public.trigger_immediate_radar(target_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    matched_count INTEGER;
BEGIN
    -- PASSO 1: EXTERMÍNIO TOTAL
    DELETE FROM radar_matched_jobs WHERE user_id = target_user_id;

    -- PASSO 2: INSERÇÃO CIRÚRGICA com TODOS os filtros incluindo max_experience
    INSERT INTO radar_matched_jobs (user_id, job_id)
    SELECT p.user_id, j.id
    FROM radar_profiles p
    JOIN public_jobs j ON (
        j.category = ANY(p.categories)
        AND (p.visa_type IS NULL OR p.visa_type = 'all' OR j.visa_type = p.visa_type)
        AND (p.state IS NULL OR p.state = 'all' OR j.state = p.state)
        AND (j.salary >= COALESCE(p.min_wage, 0))
        -- CORREÇÃO: filtro de experiência máxima agora funciona
        AND (p.max_experience IS NULL OR COALESCE(j.experience_months, 0) <= p.max_experience)
        AND (p.randomization_group = 'all' OR p.randomization_group IS NULL OR j.randomization_group = p.randomization_group)
    )
    WHERE p.user_id = target_user_id
    AND j.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM my_queue mq 
        WHERE mq.job_id = j.id AND mq.user_id = target_user_id
    )
    AND NOT EXISTS (
        SELECT 1 FROM job_reports jr 
        WHERE jr.job_id = j.id
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS matched_count = ROW_COUNT;
    RETURN matched_count;
END;
$function$;

-- ================================================================
-- FIX 2: process_daily_smtp_warmup - corrige teto por plano
-- Usa calculate_warmup_limit que já respeita o plano corretamente
-- ================================================================
CREATE OR REPLACE FUNCTION public.process_daily_smtp_warmup()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Reset diário de emails enviados
  UPDATE smtp_credentials SET emails_sent_today = 0;

  -- Atualiza o limite diário usando a função existente que já respeita o teto do plano
  UPDATE smtp_credentials s
  SET current_daily_limit = public.calculate_warmup_limit(
    s.risk_profile,
    s.current_daily_limit,
    s.emails_sent_today,  -- já foi resetado acima para 0, mas usamos o valor pós-reset
    p.plan_tier
  )
  FROM profiles p
  WHERE s.user_id = p.id 
    AND s.warmup_started_at IS NOT NULL
    AND s.risk_profile IS NOT NULL
    AND p.plan_tier != 'free';  -- usuários free NUNCA passam pelo warmup

  -- Garante que usuários free fiquem limitados a 5 independente do que estiver salvo
  UPDATE smtp_credentials s
  SET current_daily_limit = 5
  FROM profiles p
  WHERE s.user_id = p.id
    AND p.plan_tier = 'free'
    AND (s.current_daily_limit IS NULL OR s.current_daily_limit > 5);
END;
$function$;

-- ================================================================
-- FIX 2b: Corrigir dados históricos - usuários free com limit > 5
-- ================================================================
UPDATE smtp_credentials s
SET current_daily_limit = 5
FROM profiles p
WHERE s.user_id = p.id
  AND p.plan_tier = 'free'
  AND (s.current_daily_limit IS NULL OR s.current_daily_limit > 5);
