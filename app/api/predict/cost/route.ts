import { NextRequest, NextResponse } from 'next/server'

const ML_SERVER = 'http://localhost:5001'

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

    return NextResponse.json({
      ...costData,
      ...timeData
    })
  } catch (error) {
    console.error('Cost prediction error, using mock fallback:', error)
    // Fallback if ML server is not running
    const baseDuration = Number(body.base_duration_hours) || 1
    const basePrice = Number(body.base_price) || 1500
    const vehicleAge = Number(body.vehicle_age) || 0
    const vehicleType = String(body.vehicle_type || '').toLowerCase()

    // Simulate AI generation by adding modifiers based on the vehicle
    let typeMultiplier = 1.05
    if (vehicleType.includes('suv') || vehicleType.includes('truck') || vehicleType.includes('van') || vehicleType.includes('montero') || vehicleType.includes('ranger')) {
      typeMultiplier = 1.15 // 15% more time/cost for larger vehicles
    }

    // Add 1% cost and time for every year of the vehicle's age
    const ageMultiplier = 1.0 + (vehicleAge * 0.01)

    const mockDurationMins = Math.round(baseDuration * 60 * typeMultiplier * ageMultiplier)
    const mockPrice = Math.round(basePrice * typeMultiplier * ageMultiplier * 100) / 100

    return NextResponse.json({
      predicted_amount: mockPrice,
      predicted_duration_mins: mockDurationMins,
      confidence_score: 0.85,
      factors: ["Vehicle Age", "Service Complexity"],
      is_mock: true
    })
  }
}
