import { createServiceClient } from '@/lib/supabase/server'

export interface RedemptionEmailData {
  redemptionId: string
  baristaName: string
  rewardName: string
  coinsSpent: number
  newBalance: number
  redeemedAt: string
}

/**
 * Send a redemption notification email to admin(s) via Resend.
 * Called directly from the redeemReward Server Action — no webhooks needed.
 * Works locally (npm run dev) and in production (Vercel) identically.
 */
export async function sendRedemptionEmail(data: RedemptionEmailData): Promise<void> {
  const supabase = createServiceClient()

  // Pull config from DB settings, falling back to env vars
  const { data: rows } = await supabase.from('app_settings').select('key, value')
  const cfg: Record<string, string> = {}
  rows?.forEach(({ key, value }) => { if (value?.trim()) cfg[key] = value.trim() })

  // Support both ADMIN_NOTIFICATION_EMAILS (comma-separated list) and the
  // simpler ADMIN_EMAIL single-address variant used in .env.local / Vercel.
  const adminEmails = (
    cfg.admin_notification_emails ||
    process.env.ADMIN_NOTIFICATION_EMAILS ||
    process.env.ADMIN_EMAIL ||
    ''
  ).split(',').map(e => e.trim()).filter(Boolean)

  const resendKey = (cfg.resend_api_key || process.env.RESEND_API_KEY || '').trim()

  if (!adminEmails.length) {
    console.warn('[notify] Sin correos de admin configurados — omitiendo notificación.')
    return
  }
  if (!resendKey) {
    console.warn('[notify] Sin RESEND_API_KEY configurado — omitiendo notificación.')
    return
  }

  const dateStr = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(data.redeemedAt))

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // RESEND_FROM_EMAIL must be an address on a domain you have verified in Resend.
      // Until you verify a custom domain, Resend's shared address works and sends
      // to any email address in your Resend account's verified list.
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: adminEmails,
      subject: `🎁 ${data.baristaName} canjeó ${data.rewardName} en BRÜ Coins`,
      html: buildEmailHtml(data, dateStr),
      text: buildEmailText(data, dateStr),
    }),
  })

  if (res.ok) {
    // Mark redemption as notified so we don't double-send
    await supabase
      .from('redemptions')
      .update({ notified: true })
      .eq('id', data.redemptionId)
    console.log(`[notify] ✅ Email enviado — ${data.baristaName} canjeó ${data.rewardName}`)
  } else {
    const err = await res.text()
    console.error(`[notify] ❌ Error de Resend:`, err)
  }
}

// ─── Email templates ────────────────────────────────────────────────────────

function buildEmailHtml(d: RedemptionEmailData, dateStr: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;background:#DFD9C7;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;">☕</div>
        <h1 style="font-size:22px;color:#000;margin:8px 0 0;font-family:Georgia,serif;letter-spacing:-0.5px;">
          BRÜ Coins
        </h1>
      </div>

      <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:12px;">
        <p style="font-size:15px;color:#555;margin:0 0 16px;">
          Hola, tienes un nuevo canje:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;color:#8C8070;">Barista</td>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;font-weight:700;text-align:right;">${d.baristaName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;color:#8C8070;">Reward canjeado</td>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;font-weight:700;text-align:right;">${d.rewardName}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;color:#8C8070;">Coins gastados</td>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;font-weight:700;color:#D06500;text-align:right;">₿${d.coinsSpent}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;color:#8C8070;">Saldo restante</td>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;font-weight:700;color:#D06500;text-align:right;">₿${d.newBalance}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#8C8070;">Fecha</td>
            <td style="padding:10px 0;text-align:right;font-size:13px;">${dateStr}</td>
          </tr>
        </table>
      </div>

      <p style="text-align:center;font-size:12px;color:#8C8070;margin:0;">— BRÜ Coins App</p>
    </div>
  `
}

function buildEmailText(d: RedemptionEmailData, dateStr: string): string {
  return [
    'BRÜ Coins — Nuevo canje',
    '',
    `${d.baristaName} acaba de canjear: ${d.rewardName}`,
    `Coins gastados:  ₿${d.coinsSpent}`,
    `Coins restantes: ₿${d.newBalance}`,
    `Fecha: ${dateStr}`,
    '',
    '— BRÜ Coins App',
  ].join('\n')
}
