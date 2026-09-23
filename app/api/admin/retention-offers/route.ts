// app/api/admin/retention-offers/route.ts
// API route for managing retention offers in Supabase.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function generatePromoCode(offerType: string): string {
  const prefixMap: Record<string, string> = {
    percentage_discount: 'PCT',
    fixed_discount: 'FIX',
    free_service: 'FREE',
    service_reminder: 'REMIND',
    loyalty_reward: 'VIP',
  }
  const prefix = prefixMap[offerType] || 'OFFER'
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const randomNum = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${randomNum}-${randomSuffix}`
}

export async function GET(request: NextRequest) {
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
           claimed_on_job_order_id
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
  try {
    const body = await request.json()
    const {
      userId,
      offerType = 'percentage_discount',
      discountValue = 0,
      description = 'Special Customer Retention Offer',
      expirationDays = 30,
    } = body

    if (!userId || isNaN(parseInt(userId, 10))) {
      return NextResponse.json(
        { success: false, error: 'Valid userId is required' },
        { status: 400 }
      )
    }

    const validOfferTypes = [
      'percentage_discount',
      'fixed_discount',
      'free_service',
      'service_reminder',
      'loyalty_reward',
    ]
    const sanitizedOfferType = validOfferTypes.includes(offerType)
      ? offerType
      : 'percentage_discount'

    const promoCode = body.promoCode?.trim() || generatePromoCode(sanitizedOfferType)

    // Insert into retention_offers
    const { rows } = await db.query(
      `INSERT INTO retention_offers (
         user_id,
         promo_code,
         offer_type,
         discount_value,
         description,
         issue_date,
         expiration_date,
         is_claimed
       )
       VALUES (
         $1,
         $2,
         $3::promo_offer_type,
         $4,
         $5,
         CURRENT_DATE,
         CURRENT_DATE + ($6 || ' days')::INTERVAL,
         false
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
        sanitizedOfferType,
        parseFloat(discountValue) || 0,
        description,
        parseInt(expirationDays, 10) || 30,
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

    return NextResponse.json({ success: true, offer: createdOffer })
  } catch (err: unknown) {
    console.error('[/api/admin/retention-offers] POST error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to save offer' },
      { status: 500 }
    )
  }
}
