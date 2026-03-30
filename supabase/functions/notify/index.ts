// =============================================================================
// BRÜ COINS — Email Notification Edge Function
// Triggered via Supabase Database Webhook on INSERT into redemptions table.
//
// Setup in Supabase Dashboard:
//   Database → Webhooks → Create new webhook
//   Table: redemptions | Event: INSERT
//   URL: https://<your-project>.supabase.co/functions/v1/notify
//   HTTP method: POST
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    barista_id: string
    reward_id: string
    coins_spent: number
    redeemed_at: string
    notified: boolean
  }
  schema: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: WebhookPayload = await req.json()

    if (payload.type !== 'INSERT' || payload.table !== 'redemptions') {
      return new Response('Not a redemption event', { status: 200 })
    }

    const { record } = payload

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch barista and reward details
    const [{ data: barista }, { data: reward }, { data: settings }] = await Promise.all([
      supabase.from('baristas').select('name, coin_balance').eq('id', record.barista_id).single(),
      supabase.from('rewards').select('name').eq('id', record.reward_id).single(),
      supabase.from('app_settings').select('key, value'),
    ])

    if (!barista || !reward) {
      console.error('Barista o reward no encontrado')
      return new Response('Data not found', { status: 404 })
    }

    // Get admin emails and Resend key from settings or environment
    const settingsMap: Record<string, string> = {}
    settings?.forEach(({ key, value }: { key: string; value: string }) => {
      settingsMap[key] = value
    })

    const adminEmails = (
      settingsMap.admin_notification_emails ||
      Deno.env.get('ADMIN_NOTIFICATION_EMAILS') ||
      ''
    )
      .split(',')
      .map((e: string) => e.trim())
      .filter(Boolean)

    const resendApiKey =
      settingsMap.resend_api_key ||
      Deno.env.get('RESEND_API_KEY') ||
      ''

    if (adminEmails.length === 0) {
      console.warn('No admin emails configured. Skipping notification.')
      return new Response('No recipients configured', { status: 200 })
    }

    if (!resendApiKey) {
      console.warn('No Resend API key configured. Skipping notification.')
      return new Response('No API key configured', { status: 200 })
    }

    // Format date in Spanish (Mexico timezone)
    const date = new Date(record.redeemed_at)
    const dateStr = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Mexico_City',
    }).format(date)

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BRÜ Coins <noreply@brucoins.app>',  // Change to your verified domain in Resend
        to: adminEmails,
        subject: `🎁 ${barista.name} canjeó ${reward.name} en BRÜ Coins`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; background: #DFD9C7; padding: 32px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 32px;">☕</span>
              <h1 style="font-size: 24px; color: #000; margin: 8px 0 0; font-family: 'Georgia', serif;">BRÜ Coins</h1>
            </div>

            <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
              <p style="font-size: 16px; color: #555; margin: 0 0 16px;">Hola, tienes un nuevo canje:</p>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; color: #8C8070; font-size: 14px;">Barista</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; font-weight: bold; text-align: right;">${barista.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; color: #8C8070; font-size: 14px;">Reward canjeado</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; font-weight: bold; text-align: right;">${reward.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; color: #8C8070; font-size: 14px;">Coins gastados</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; font-weight: bold; color: #D06500; text-align: right;">₿${record.coins_spent}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; color: #8C8070; font-size: 14px;">Saldo restante</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #E8E2D4; font-weight: bold; color: #D06500; text-align: right;">₿${barista.coin_balance}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #8C8070; font-size: 14px;">Fecha</td>
                  <td style="padding: 10px 0; text-align: right; font-size: 13px;">${dateStr}</td>
                </tr>
              </table>
            </div>

            <p style="text-align: center; font-size: 12px; color: #8C8070; margin: 0;">
              — BRÜ Coins App
            </p>
          </div>
        `,
        text: `
BRÜ Coins — Nuevo canje

${barista.name} acaba de canjear: ${reward.name}
Coins gastados: ₿${record.coins_spent}
Coins restantes: ₿${barista.coin_balance}
Fecha: ${dateStr}

— BRÜ Coins App
        `.trim(),
      }),
    })

    if (!emailResponse.ok) {
      const errText = await emailResponse.text()
      console.error('Resend error:', errText)
      return new Response(`Email error: ${errText}`, { status: 500 })
    }

    // Mark redemption as notified
    await supabase
      .from('redemptions')
      .update({ notified: true })
      .eq('id', record.id)

    console.log(`✅ Notificación enviada para ${barista.name} — ${reward.name}`)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Error en Edge Function:', err)
    return new Response(String(err), { status: 500 })
  }
})
