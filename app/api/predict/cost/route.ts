import { NextRequest, NextResponse } from 'next/server'

const ML_SERVER = process.env.ML_SERVER_URL || 'http://127.0.0.1:5001'

export async function POST(req: NextRequest) {
  let body: any = {}
  try {
    body = await req.json()

    // 1. Fetch Time prediction first
    const timeRes = await fetch(`${ML_SERVER}/predict/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const timeData = await timeRes.json()

    // 2. Inject predicted time into body for the Cost model
    if (timeData.predicted_duration_mins) {
      body.predicted_duration_mins = timeData.predicted_duration_mins
    }

    // 3. Fetch Cost prediction using the predicted time
    const costRes = await fetch(`${ML_SERVER}/predict/cost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const costData = await costRes.json()

    // Cold-start gating: if service has insufficient sample count
    if (costData.can_estimate === false || timeData.can_estimate === false) {
      return NextResponse.json({
        can_estimate: false,
        is_low_data: true,
        sample_count: costData.sample_count ?? timeData.sample_count ?? 0,
        min_samples_required: costData.min_samples_required ?? 10,
        predicted_amount: null,
        predicted_duration_mins: null,
        message: costData.message || 'Need more historical data for AI estimation',
      })
    }

    const basePrice = Number(body.base_price) || 1500
    const isFixed = Boolean(body.is_price_fixed)

    let finalAmount = Number(costData.predicted_amount) || basePrice

    if (isFixed) {
      // Fixed-price services strictly preserve the baseline catalog price
      finalAmount = basePrice
    } else {
      // Sensible boundary clamp (0.85x to 1.75x of base price) to prevent runaway extremes
      const minBound = Math.round(basePrice * 0.85)
      const maxBound = Math.round(basePrice * 1.75)
      finalAmount = Math.max(minBound, Math.min(maxBound, finalAmount))
      finalAmount = Math.round(finalAmount / 25) * 25
    }

    return NextResponse.json({
      ...costData,
      ...timeData,
      predicted_amount: finalAmount,
      price_ratio: Number((finalAmount / (basePrice || 1)).toFixed(2)),
    })
  } catch (error) {
    console.error('Cost prediction error, using mock fallback:', error)
    // Fallback if ML server is not running
    const baseDuration = Number(body.base_duration_hours) || 1
    const basePrice = Number(body.base_price) || 1500
    const vehicleAge = Number(body.vehicle_age) || 0
    const vehicleType = String(body.vehicle_type || '').toLowerCase()
    const isFixed = Boolean(body.is_price_fixed)

    // Modifiers based on vehicle body type
    let typeMultiplier = 1.05
    if (vehicleType.includes('suv') || vehicleType.includes('truck') || vehicleType.includes('van') || vehicleType.includes('montero') || vehicleType.includes('ranger')) {
      typeMultiplier = 1.18 // 18% more time for larger/heavier vehicles
    }

    // Add 1.2% duration for every year of the vehicle's age
    const ageMultiplier = 1.0 + (vehicleAge * 0.012)
    const mockDurationMins = Math.round(baseDuration * 60 * typeMultiplier * ageMultiplier)

    let mockPrice = basePrice
    if (!isFixed) {
      const timeRatio = mockDurationMins / ((baseDuration || 1) * 60)
      const clampedRatio = Math.min(1.65, Math.max(0.85, timeRatio))
      mockPrice = Math.round((basePrice * clampedRatio) / 25) * 25
    }

    return NextResponse.json({
      predicted_amount: mockPrice,
      predicted_duration_mins: mockDurationMins,
      time_ratio: Number((mockDurationMins / ((baseDuration || 1) * 60)).toFixed(2)),
      price_ratio: Number((mockPrice / (basePrice || 1)).toFixed(2)),
      confidence_score: 0.85,
      factors: ["Vehicle Age", "Service Complexity", "Body Class"],
      is_mock: true
    })
  }
}
