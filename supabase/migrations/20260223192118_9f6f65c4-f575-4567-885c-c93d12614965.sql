
CREATE OR REPLACE FUNCTION public.get_normalized_category(raw_cat text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN CASE
    WHEN raw_cat ILIKE ANY (ARRAY['%Agricul%', '%Farmworker%', '%Crop%', '%Harvest%', '%Animal%', '%Livestock%', '%Nursery%', '%Greenhouse%', '%Forest%', '%Soil%', '%Logging%', '%Fishing%', '%Graders%']) THEN 'campo_colheita'
    WHEN raw_cat ILIKE ANY (ARRAY['%Construction%', '%Mason%', '%Roofer%', '%Plasterer%', '%Plumber%', '%Electrician%', '%Painter%', '%Carpenter%', '%Iron%', '%Paving%', '%Fence%', '%Insulation%', '%Floor%']) THEN 'construcao_manutencao'
    WHEN raw_cat ILIKE ANY (ARRAY['%Landscap%', '%Groundskeep%', '%Pesticide%', '%Tree Trimmer%', '%Mowing%', '%Paver%']) THEN 'paisagismo_jardinagem'
    WHEN raw_cat ILIKE ANY (ARRAY['%Hotel%', '%Maids%', '%Housekeep%', '%Janitor%', '%Baggage%', '%Lodging%', '%Resort%', '%Cleaning%']) THEN 'hotelaria_limpeza'
    WHEN raw_cat ILIKE ANY (ARRAY['%Cook%', '%Chef%', '%Baker%', '%Barista%', '%Bartender%', '%Dishwasher%', '%Dining%', '%Host%', '%Food Prep%', '%Fast Food%', '%Batchmaker%']) THEN 'cozinha_restaurante'
    WHEN raw_cat ILIKE ANY (ARRAY['%Driver%', '%Truck%', '%Shuttle%', '%Transport%', '%Pilot%', '%Stockers%', '%Order Filler%']) THEN 'logistica_transporte'
    WHEN raw_cat ILIKE ANY (ARRAY['%Assembler%', '%Meat%', '%Slaughterer%', '%Packer%', '%Machine%', '%Sawing%', '%Textile%', '%Welder%', '%Production%']) THEN 'industria_producao'
    WHEN raw_cat ILIKE ANY (ARRAY['%Mechanic%', '%Repair%', '%Automotive%', '%Bicycle%', '%Technician%']) THEN 'mecanica_reparo'
    WHEN raw_cat ILIKE ANY (ARRAY['%Cashier%', '%Retail%', '%Sales%', '%Receptionist%', '%Clerk%', '%Vendor%']) THEN 'vendas_escritorio'
    WHEN raw_cat ILIKE ANY (ARRAY['%Amusement%', '%Recreation%', '%Lifeguard%', '%Coach%', '%Tour%', '%Nanny%', '%Health%', '%Nursing%']) THEN 'lazer_servicos'
    ELSE 'outros_segmentos'
  END;
END;
$function$;
