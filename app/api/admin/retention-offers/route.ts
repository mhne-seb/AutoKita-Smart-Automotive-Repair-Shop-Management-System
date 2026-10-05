import { requireStaff } from '@/lib/authGuard'
// app/api/admin/retention-offers/route.ts
// API route for managing retention offers in Supabase.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendOfferEmail, isMailConfigured } from '@/lib/mail'
import { getVoucherRule } from '@/data/voucherRules'

export async function GET(request: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')

    if (userIdParam) {
      const userId = parseInt(userIdParam, 10)
      if (isNaN(userId)) {
        return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
      }
      const { rows } = await db.query(
        `SELECT 
           id,
           user_id,
           promo_code,
           offer_type::text AS offer_type,
           discount_value::float AS discount_value,
           description,
           issue_date::text AS issue_date,
           expiration_date::text AS expiration_date,
           is_claimed,
           claimed_on_job_order_id,
           rule_key,
           discount_applied::float AS discount_applied
         FROM retention_offers
         WHERE user_id = $1
         ORDER BY id DESC`,
        [userId]
      )
      return NextResponse.json({ success: true, offers: rows })
    }

    // Fetch all active / recent retention offers
    const { rows } = await db.query(
      `SELECT 
         ro.id,
         ro.user_id,
         ro.promo_code,
         ro.offer_type::text AS offer_type,
         ro.discount_value::float AS discount_value,
         ro.description,
         ro.issue_date::text AS issue_date,
         ro.expiration_date::text AS expiration_date,
         ro.is_claimed,
         ro.claimed_on_job_order_id,
         ro.rule_key,
         ro.discount_applied::float AS discount_applied,
         CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
         u.contact_number,
         u.email
       FROM retention_offers ro
       JOIN users u ON u.id = ro.user_id
       ORDER BY ro.id DESC
       LIMIT 300`
    )

    return NextResponse.json({ success: true, offers: rows })
  } catch (err: unknown) {
    console.error('[/api/admin/retention-offers] GET error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const body = await request.json()
    const { userId, ruleKey } = body

    if (!userId || isNaN(parseInt(userId, 10))) {
      return NextResponse.json(
        { success: false, error: 'Valid userId is required' },
        { status: 400 }
      )
    }

    const rule = getVoucherRule(ruleKey)
    if (!rule) {
      return NextResponse.json({ success: false, error: 'Choose one of the listed offers.' }, { status: 400 })
    }

    const description = `${rule.label}. ${rule.description}`
    const expirationDays = 30
    const promoCode = `${rule.key}-${Math.floor(100 + Math.random() * 900)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const custRes = await db.query(`SELECT id, email, first_name, nickname FROM users WHERE id = $1`, [parseInt(userId, 10)])
    const customer = custRes.rows[0]
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 })
    }

    // Insert into retention_offers
    const unused = await db.query(
      `SELECT 1 FROM retention_offers
        WHERE user_id = $1 AND is_claimed = false AND rule_key IS NOT NULL
          AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
        LIMIT 1`,
      [customer.id],
    )
    if (unused.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'This customer already has an unused offer. They can get a new one after using it or when it expires.' },
        { status: 409 },
      )
    }

    const { rows } = await db.query(
      `INSERT INTO retention_offers (
         user_id,
         promo_code,
         offer_type,
         discount_value,
         description,
         issue_date,
         expiration_date,
         is_claimed,
         rule_key
       )
       VALUES (
         $1,
         $2,
         $3::promo_offer_type,
         $4,
         $5,
         CURRENT_DATE,
         CURRENT_DATE + ($6 || ' days')::INTERVAL,
         false,
         $7
       )
       RETURNING 
         id,
         user_id,
         promo_code,
         offer_type::text AS offer_type,
         discount_value::float AS discount_value,
         description,
         issue_date::text AS issue_date,
         expiration_date::text AS expiration_date,
         is_claimed`,
      [
        parseInt(userId, 10),
        promoCode,
        rule.offerType,
        rule.value,
        description,
        expirationDays,
        rule.key,
      ]
    )

    const createdOffer = rows[0]

    // Optional: write to system_audit_logs
    try {
      await db.query(
        `INSERT INTO system_audit_logs (
           user_id,
           action_performed,
           entity_type,
           entity_id,
           new_values,
           action_date
         )
         VALUES ($1, 'created', 'retention_offers', $2, $3, NOW())`,
        [
          parseInt(userId, 10),
          createdOffer.id,
          JSON.stringify(createdOffer),
        ]
      )
    } catch (auditErr) {
      // Non-fatal if audit logging fails
      console.warn('Could not record system_audit_log for retention offer:', auditErr)
    }

    // "Valid until Nov 4, 2026" - expiration_date comes back as 'YYYY-MM-DD'.
    const validUntil = createdOffer.expiration_date
      ? new Date(`${String(createdOffer.expiration_date).slice(0, 10)}T00:00:00+08:00`)
          .toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
      : null

    // 1. Notification in the customer's bell and notification list.
    let notified = false
    try {
      const payload = JSON.stringify({
        notify: true,
        event: 'promo_offer',
        title: 'You have a new offer',
        message:
          `${description.trim().replace(/([^.!?])$/, '$1.')} Promo code: ${createdOffer.promo_code}.` +
          (validUntil ? ` Valid until ${validUntil}.` : '') +
          ' Enter the code on your Billing page when your service is done.',
      })
      await db.query(
        `INSERT INTO system_audit_logs (user_id, employees_id, action_performed, entity_type, entity_id, new_values, action_date)
         VALUES ($1, $2, 'status_changed'::audit_action_enum, 'retention_offers', $3, $4, NOW())`,
        [customer.id, auth.session.userId, createdOffer.id, payload],
      )
      notified = true
    } catch (notifyErr) {
      console.error('Could not save the offer notification:', notifyErr)
    }

    // 2. Email. Waited for (so the admin is told the truth), but a mail failure never undoes the offer.
    let emailed = false
    if (customer.email && isMailConfigured()) {
      try {
        await sendOfferEmail({
          to: customer.email,
          name: customer.first_name || customer.nickname || 'there',
          offerText: String(description),
          promoCode: createdOffer.promo_code,
          validUntil,
        })
        emailed = true
      } catch (mailErr) {
        console.error('Offer email failed:', mailErr)
      }
    }

    return NextResponse.json({ success: true, offer: createdOffer, notified, emailed })
  } catch (err: unknown) {
    console.error('[/api/admin/retention-offers] POST error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save offer' },
      { status: 500 }
    )
  }
}
