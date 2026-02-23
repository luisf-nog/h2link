
CREATE OR REPLACE FUNCTION public.get_normalized_category(raw_cat text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN CASE
    -- 1. agricultura_colheita (Agriculture & Crop)
    WHEN raw_cat ILIKE ANY (ARRAY['%Farmworker%', '%Crop%', '%Nursery%', '%Greenhouse%', '%Harvest%', '%Agricultural%', '%Forest%', '%Conservation%', '%Animal Caretaker%', '%Aquacultural%', '%Ranch%', '%First-Line Supervisors of Farming%', '%Graders and Sorters, Agricultural%', '%Agriculture%', '%Fishing%', '%Logging%', '%Soil%', '%Livestock%', '%Cutters and Trimmers, Hand%']) THEN 'agricultura_colheita'
    
    -- 2. equipamentos_agricolas (Farm Equipment)
    WHEN raw_cat ILIKE ANY (ARRAY['%Agricultural Equipment%', '%Tractor%', '%Ag Equipment%', '%Farm Equipment%']) THEN 'equipamentos_agricolas'
    
    -- 12. logistica_estoque (Logistics & Warehousing) - BEFORE construction to avoid %Laborer% conflict
    WHEN raw_cat ILIKE ANY (ARRAY['%Freight%', '%Stocker%', '%Packer%', '%Material Mover%', '%Order Filler%', '%Refuse%', '%Recyclable%']) THEN 'logistica_estoque'
    
    -- 3. construcao_geral (Construction)
    WHEN raw_cat ILIKE ANY (ARRAY['%Construction%', '%Cement%', '%Mason%', '%Concrete%', '%Fence Erector%', '%Brickmason%', '%Blockmason%', '%Stonemason%', '%Iron%', '%Rebar%', '%Paving%', '%Drywall%', '%Ceiling Tile%', '%Highway Maintenance%', '%Manufactured Building%', '%Mobile Home Installer%', '%Rock Splitters%', '%Quarry%', '%Tile and Stone Setter%', '%Stone Cutter%', '%Hazardous Materials%', '%Plasterer%', '%Insulation%', '%Floor Layer%']) THEN 'construcao_geral'
    
    -- 4. carpintaria_telhados (Carpentry & Roofing)
    WHEN raw_cat ILIKE ANY (ARRAY['%Carpenter%', '%Cabinetmaker%', '%Bench Carpenter%', '%Roofer%', '%Upholsterer%']) THEN 'carpintaria_telhados'
    
    -- 5. instalacao_eletrica (Installation & Electrical)
    WHEN raw_cat ILIKE ANY (ARRAY['%Electrician%', '%Plumber%', '%Pipelayer%', '%Septic%', '%Pump Operator%', '%Helpers--Installation%']) THEN 'instalacao_eletrica'
    
    -- 6. mecanica_reparo (Mechanics & Repair)
    WHEN raw_cat ILIKE ANY (ARRAY['%Mechanic%', '%Service Technician%', '%Automotive%', '%Diesel%', '%Bicycle%', '%Maintenance and Repair%', '%Installation, Maintenance, and Repair Workers, All Other%']) THEN 'mecanica_reparo'
    
    -- 7. limpeza_zeladoria (Cleaning & Janitorial)
    WHEN raw_cat ILIKE ANY (ARRAY['%Maid%', '%Housekeep%', '%Janitor%', '%Cleaner%', '%Cleaning%']) THEN 'limpeza_zeladoria'
    
    -- 9. servico_mesa (Dining & Table Service) - BEFORE kitchen to avoid %Fast Food% conflict
    WHEN raw_cat ILIKE ANY (ARRAY['%Waiter%', '%Waitress%', '%Dining Room%', '%Hostess%', '%Dishwasher%', '%Food Server%', '%Cafeteria Attendant%', '%Bartender Helper%']) THEN 'servico_mesa'
    
    -- 8. cozinha_preparacao (Kitchen & Food Prep)
    WHEN raw_cat ILIKE ANY (ARRAY['%Cook%', '%Chef%', '%Baker%', '%Food Prep%', '%Food Service Manager%', '%Kitchen%', '%Batchmaker%', '%First-Line Supervisors of Food%', '%Fast Food%']) THEN 'cozinha_preparacao'
    
    -- 10. hotelaria_recepcao (Hospitality & Front Desk)
    WHEN raw_cat ILIKE ANY (ARRAY['%Hotel%', '%Resort%', '%Desk Clerk%', '%Concierge%', '%Baggage%', '%Bellhop%', '%Lodging%', '%Locker Room%', '%Coatroom%']) THEN 'hotelaria_recepcao'
    
    -- 11. bar_bebidas (Bar & Beverages)
    WHEN raw_cat ILIKE ANY (ARRAY['%Barista%', '%Bartender%']) THEN 'bar_bebidas'
    
    -- 13. transporte_motorista (Transport & Driving)
    WHEN raw_cat ILIKE ANY (ARRAY['%Truck Driver%', '%Shuttle%', '%Chauffeur%', '%Delivery%', '%Light Truck%', '%Heavy and Tractor-Trailer%', '%Pilot%']) THEN 'transporte_motorista'
    
    -- 15. soldagem_corte (Welding & Cutting) - BEFORE manufacturing
    WHEN raw_cat ILIKE ANY (ARRAY['%Welder%', '%Solderer%', '%Brazer%']) THEN 'soldagem_corte'
    
    -- 14. manufatura_montagem (Manufacturing & Assembly)
    WHEN raw_cat ILIKE ANY (ARRAY['%Assembler%', '%Fabricator%', '%Production Worker%', '%Machine Feeder%', '%Machine Operator%', '%Team Assembler%', '%Molders%', '%Shapers%', '%Casters%', '%Helpers--Production%']) THEN 'manufatura_montagem'
    
    -- 18. carnes_frigorifico (Meat Processing) 
    WHEN raw_cat ILIKE ANY (ARRAY['%Meat%', '%Poultry%', '%Butcher%', '%Slaughter%', '%Fish Cutter%']) THEN 'carnes_frigorifico'
    
    -- 16. marcenaria_madeira (Woodworking)
    WHEN raw_cat ILIKE ANY (ARRAY['%Woodwork%', '%Sawing Machine%', '%Sawmill%']) THEN 'marcenaria_madeira'
    
    -- 17. textil_lavanderia (Textile & Laundry)
    WHEN raw_cat ILIKE ANY (ARRAY['%Textile%', '%Laundry%', '%Sewing%', '%Pressing%']) THEN 'textil_lavanderia'
    
    -- 19. paisagismo_jardinagem (Landscaping & Gardening)
    WHEN raw_cat ILIKE ANY (ARRAY['%Landscap%', '%Groundskeep%', '%Tree Trimmer%', '%Pruner%', '%Grounds Maintenance%', '%Pesticide%', '%Segmental Paver%']) THEN 'paisagismo_jardinagem'
    
    -- 20. vendas_atendimento (Sales & Customer Service)
    WHEN raw_cat ILIKE ANY (ARRAY['%Salesperson%', '%Counter%', '%Cashier%', '%Retail%', '%Vendor%', '%Receptionist%', '%Door-to-Door%']) THEN 'vendas_atendimento'
    
    -- 21. lazer_servicos (Leisure & Services)
    WHEN raw_cat ILIKE ANY (ARRAY['%Amusement%', '%Recreation%', '%Lifeguard%', '%Coach%', '%Tour%', '%Nanny%', '%Personal Care%', '%Travel Guide%']) THEN 'lazer_servicos'
    
    ELSE 'outros_segmentos'
  END;
END;
$function$;
