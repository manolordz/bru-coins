import { createServiceClient } from '@/lib/supabase/server'

// ─── Shared helpers ──────────────────────────────────────────────────────────

const SANS = 'Nunito, system-ui, -apple-system, sans-serif'

async function getNotifyConfig(): Promise<{ adminEmails: string[]; resendKey: string; from: string }> {
  const supabase = createServiceClient()
  const { data: rows } = await supabase.from('app_settings').select('key, value')
  const cfg: Record<string, string> = {}
  rows?.forEach(({ key, value }: { key: string; value: string }) => {
    if (value?.trim()) cfg[key] = value.trim()
  })

  const adminEmails = (
    cfg.admin_notification_emails ||
    process.env.ADMIN_NOTIFICATION_EMAILS ||
    process.env.ADMIN_EMAIL ||
    ''
  ).split(',').map((e: string) => e.trim()).filter(Boolean)

  const resendKey = (cfg.resend_api_key || process.env.RESEND_API_KEY || '').trim()
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  return { adminEmails, resendKey, from }
}

async function sendEmail(opts: {
  resendKey: string
  from: string
  to: string[]
  subject: string
  html: string
  text: string
}): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[notify] ❌ Error de Resend:', err)
  }
  return res.ok
}

// ─── Redemption email ────────────────────────────────────────────────────────

export interface RedemptionEmailData {
  redemptionId: string
  baristaName: string
  rewardName: string
  coinsSpent: number
  newBalance: number
  redeemedAt: string
}

export async function sendRedemptionEmail(data: RedemptionEmailData): Promise<void> {
  const { adminEmails, resendKey, from } = await getNotifyConfig()

  if (!adminEmails.length) {
    console.warn('[notify] Sin correos de admin configurados — omitiendo notificación.')
    return
  }
  if (!resendKey) {
    console.warn('[notify] Sin RESEND_API_KEY configurado — omitiendo notificación.')
    return
  }

  const dateStr = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Mexico_City',
  }).format(new Date(data.redeemedAt))

  const ok = await sendEmail({
    resendKey, from, to: adminEmails,
    subject: `🎁 ${data.baristaName} canjeó ${data.rewardName} en BRÜ Coins`,
    html: buildRedemptionHtml(data, dateStr),
    text: buildRedemptionText(data, dateStr),
  })

  if (ok) {
    const supabase = createServiceClient()
    await supabase.from('redemptions').update({ notified: true }).eq('id', data.redemptionId)
    console.log(`[notify] ✅ Email de canje enviado — ${data.baristaName} → ${data.rewardName}`)
  }
}

// ─── Coin request email ──────────────────────────────────────────────────────

export interface CoinRequestEmailData {
  baristaName: string
  totalCoins: number
  items: { description: string; subtotal: number }[]
  submittedAt: string
}

export async function sendCoinRequestEmail(data: CoinRequestEmailData): Promise<void> {
  const { adminEmails, resendKey, from } = await getNotifyConfig()

  if (!adminEmails.length) {
    console.warn('[notify] Sin correos de admin configurados — omitiendo notificación de solicitud.')
    return
  }
  if (!resendKey) {
    console.warn('[notify] Sin RESEND_API_KEY configurado — omitiendo notificación de solicitud.')
    return
  }

  const dateStr = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Mexico_City',
  }).format(new Date(data.submittedAt))

  const ok = await sendEmail({
    resendKey, from, to: adminEmails,
    subject: `📬 ${data.baristaName} solicitó +₿${data.totalCoins} en BRÜ Coins`,
    html: buildCoinRequestHtml(data, dateStr),
    text: buildCoinRequestText(data, dateStr),
  })

  if (ok) {
    console.log(`[notify] ✅ Email de solicitud enviado — ${data.baristaName} solicitó +₿${data.totalCoins}`)
  }
}

// ─── Email templates ─────────────────────────────────────────────────────────

function buildRedemptionHtml(d: RedemptionEmailData, dateStr: string): string {
  return `
    <div style="font-family:${SANS};max-width:480px;margin:0 auto;background:#DFD9C7;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;">☕</div>
        <h1 style="font-size:22px;color:#000;margin:8px 0 0;font-family:${SANS};font-weight:700;letter-spacing:-0.3px;">
          BRÜ Coins
        </h1>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:12px;">
        <p style="font-size:15px;color:#555;margin:0 0 16px;">Hola, tienes un nuevo canje:</p>
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

function buildRedemptionText(d: RedemptionEmailData, dateStr: string): string {
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

function buildCoinRequestHtml(d: CoinRequestEmailData, dateStr: string): string {
  const itemRows = d.items.map(item => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #E8E2D4;color:#333;font-size:13px;">${item.description}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E8E2D4;font-weight:700;color:#16a34a;text-align:right;font-size:13px;">+₿${item.subtotal}</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:${SANS};max-width:480px;margin:0 auto;background:#DFD9C7;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;">☕</div>
        <h1 style="font-size:22px;color:#000;margin:8px 0 0;font-family:${SANS};font-weight:700;letter-spacing:-0.3px;">
          BRÜ Coins
        </h1>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:12px;">
        <p style="font-size:15px;color:#555;margin:0 0 4px;">
          <strong>${d.baristaName}</strong> ha enviado una solicitud de coins:
        </p>
        <p style="font-size:13px;color:#8C8070;margin:0 0 16px;">${dateStr}</p>
        <table style="width:100%;border-collapse:collapse;">
          ${itemRows}
          <tr>
            <td style="padding:10px 0 0;font-weight:700;font-size:15px;">Total solicitado</td>
            <td style="padding:10px 0 0;font-weight:800;color:#D06500;text-align:right;font-size:18px;">+₿${d.totalCoins}</td>
          </tr>
        </table>
      </div>
      <p style="text-align:center;font-size:12px;color:#8C8070;margin:0;">
        Revisa y aprueba en el panel de administración → BRÜ Coins App
      </p>
    </div>
  `
}

function buildCoinRequestText(d: CoinRequestEmailData, dateStr: string): string {
  const itemLines = d.items.map(item => `  • ${item.description}: +₿${item.subtotal}`)
  return [
    'BRÜ Coins — Nueva solicitud de coins',
    '',
    `${d.baristaName} solicita +₿${d.totalCoins}`,
    `Fecha: ${dateStr}`,
    '',
    'Razones:',
    ...itemLines,
    '',
    'Revisa y aprueba en el panel de administración.',
    '',
    '— BRÜ Coins App',
  ].join('\n')
}

// ─── Proposal email ──────────────────────────────────────────────────────────

export interface ProposalEmailData {
  baristaName: string
  ideaType: string
  message: string
  submittedAt: string
}

const IDEA_TYPE_LABELS: Record<string, string> = {
  nueva_recompensa: 'Nueva Recompensa',
  idea_mejora: 'Idea de Mejora',
  otro: 'Otro Comentario',
}

export async function sendProposalEmail(data: ProposalEmailData): Promise<void> {
  const { adminEmails, resendKey, from } = await getNotifyConfig()

  if (!adminEmails.length) {
    console.warn('[notify] Sin correos de admin — omitiendo notificación de propuesta.')
    return
  }
  if (!resendKey) {
    console.warn('[notify] Sin RESEND_API_KEY — omitiendo notificación de propuesta.')
    return
  }

  const dateStr = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Mexico_City',
  }).format(new Date(data.submittedAt))

  const ok = await sendEmail({
    resendKey, from, to: adminEmails,
    subject: `💡 Nueva propuesta de ${data.baristaName} en BRÜ Coins`,
    html: buildProposalHtml(data, dateStr),
    text: buildProposalText(data, dateStr),
  })

  if (ok) {
    console.log(`[notify] ✅ Email de propuesta enviado — ${data.baristaName}`)
  }
}

function buildProposalHtml(d: ProposalEmailData, dateStr: string): string {
  const typeLabel = IDEA_TYPE_LABELS[d.ideaType] ?? d.ideaType
  return `
    <div style="font-family:${SANS};max-width:480px;margin:0 auto;background:#DFD9C7;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;">💡</div>
        <h1 style="font-size:22px;color:#000;margin:8px 0 0;font-family:${SANS};font-weight:700;letter-spacing:-0.3px;">BRÜ Coins</h1>
      </div>
      <div style="background:#fff;border-radius:12px;padding:24px;margin-bottom:12px;">
        <p style="font-size:15px;color:#555;margin:0 0 16px;">
          <strong>${d.baristaName}</strong> envió una nueva propuesta:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;color:#8C8070;vertical-align:top;">Tipo</td>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;font-weight:700;text-align:right;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;color:#8C8070;vertical-align:top;">Propuesta</td>
            <td style="padding:10px 0;border-bottom:1px solid #E8E2D4;text-align:right;line-height:1.5;">${d.message}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#8C8070;">Fecha</td>
            <td style="padding:10px 0;text-align:right;font-size:13px;">${dateStr}</td>
          </tr>
        </table>
      </div>
      <p style="text-align:center;font-size:12px;color:#8C8070;margin:0;">
        Revísala en Propuestas del panel de administración → BRÜ Coins App
      </p>
    </div>
  `
}

function buildProposalText(d: ProposalEmailData, dateStr: string): string {
  const typeLabel = IDEA_TYPE_LABELS[d.ideaType] ?? d.ideaType
  return [
    'BRÜ Coins — Nueva propuesta',
    '',
    `De: ${d.baristaName}`,
    `Tipo: ${typeLabel}`,
    `Fecha: ${dateStr}`,
    '',
    d.message,
    '',
    'Revisa en el panel de administración.',
    '',
    '— BRÜ Coins App',
  ].join('\n')
}
