-- =============================================================================
-- BRÜ COINS — Seed Data
-- Run AFTER 001_schema.sql
-- =============================================================================

-- =============================================================================
-- BARISTAS (5 team members, starting with ₿0)
-- Admins will upload avatars and set PINs from the panel.
-- =============================================================================

insert into baristas (name, coin_balance, total_coins_earned, is_active)
values
  ('Edson',  0, 0, true),
  ('Kaylie', 0, 0, true),
  ('Miza',   0, 0, true),
  ('Sofía',  0, 0, true),
  ('Clau',   0, 0, true)
on conflict do nothing;

-- =============================================================================
-- REWARDS CATALOG (9 rewards)
-- Admins can upload real images from the panel to replace the emoji placeholders.
-- =============================================================================

insert into rewards (name, description, price, is_available)
values
  (
    'Bebida en BRÜ',
    'Una bebida de tu elección en BRÜ. ¡Te la mereces!',
    2,
    true
  ),
  (
    'Postre en BRÜ',
    'El postre que tú elijas del menú BRÜ.',
    2,
    true
  ),
  (
    'Panini en BRÜ',
    'Un delicioso panini de la carta para reponer energías.',
    4,
    true
  ),
  (
    'Bebida para amigo en BRÜ',
    'Invita a un amigo a una bebida en BRÜ. ¡Comparte el cariño!',
    6,
    true
  ),
  (
    'Sesión de terapia',
    'Una sesión completa de terapia psicológica. Tu bienestar importa.',
    8,
    true
  ),
  (
    'Ride en Uber ($150)',
    'Un ride en Uber con saldo de hasta $150 pesos.',
    10,
    true
  ),
  (
    'Cena para 2 ($300)',
    'Una cena especial para 2 personas con presupuesto de $300 pesos.',
    15,
    true
  ),
  (
    'Smartfit 1 mes',
    'Un mes completo de membresía en Smartfit. ¡A entrenar!',
    20,
    true
  ),
  (
    'Gift Card Amazon ($400)',
    'Gift Card de Amazon por $400 pesos. Compra lo que quieras.',
    30,
    true
  )
on conflict do nothing;

-- =============================================================================
-- APP SETTINGS (default values)
-- =============================================================================

insert into app_settings (key, value)
values
  ('admin_notification_emails', ''),   -- set from the admin panel or via ADMIN_NOTIFICATION_EMAILS env
  ('resend_api_key', '')               -- set from the admin panel or via RESEND_API_KEY env
on conflict (key) do nothing;
