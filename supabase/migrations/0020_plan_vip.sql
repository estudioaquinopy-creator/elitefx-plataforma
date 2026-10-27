-- 0020 · Solo dos planes: gratuito y VIP. Los que tenían "Scanner" pasan a VIP (se guarda como "live_trading"). Idempotente.
update public.perfiles set plan = 'live_trading' where plan = 'scanner';
