import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from '@/lib/plate'
import { logStaffCustomerEdit } from '@/lib/audit'
import { sendJobUpdateEmail } from '@/lib/mail'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    if (session.role !== 'staff') {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const jobId = Number(id)

    // Check job order lock & get user/vehicle ids
    const jobOrderResult = await db.query(
      `SELECT user_id, vehicle_id, status FROM job_orders WHERE id = $1`,
      [jobId]
    )
    if (jobOrderResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }
    const { user_id, vehicle_id, status } = jobOrderResult.rows[0]
    
    if (['completed', 'released', 'cancelled'].includes(status)) {
      return NextResponse.json({ success: false, message: 'Details are locked once the job is completed.' }, { status: 409 })
    }

    const body = await request.json()
    
    // Validation
    const errors: string[] = []
    
    // names
    let firstName = body.firstName !== undefined ? (body.firstName || '').trim() : undefined
    let lastName = body.lastName !== undefined ? (body.lastName || '').trim() : undefined
    if (firstName !== undefined && !firstName) errors.push('First name is required.')
    if (lastName !== undefined && !lastName) errors.push('Last name is required.')
    if (firstName && firstName.length > 50) errors.push('First name is too long.')
    if (lastName && lastName.length > 50) errors.push('Last name is too long.')
    
    // address
    let address = body.address !== undefined ? (body.address || '').trim() : undefined
    if (address === '') address = null
    if (address && address.length > 200) errors.push('Address must be 200 characters or less.')
    
    // contact number
    let contactNumber = body.contactNumber !== undefined ? (body.contactNumber || '').trim() : undefined
    if (contactNumber !== undefined) {
      const cleanedPhone = contactNumber.replace(/[\s-]/g, '')
      if (!/^(\+?63|0)9\d{9}$/.test(cleanedPhone)) {
        errors.push('Invalid contact number format.')
      } else {
        contactNumber = cleanedPhone
      }
    }
    
    // email
    let email = body.email !== undefined ? (body.email || '').trim() : undefined
    if (email !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid email format.')
      }
    }
    
    // vehicle
    const v = body.vehicle || {}
    let plateNumber = v.plateNumber !== undefined ? (v.plateNumber || '').trim() : undefined
    let make = v.make !== undefined ? (v.make || '').trim() : undefined
    let model = v.model !== undefined ? (v.model || '').trim() : undefined
    let rawYear = v.year !== undefined ? String(v.year).trim() : undefined
    let year: number | null | undefined = undefined

    if (rawYear !== undefined) {
      if (rawYear === '') {
        year = null
      } else {
        year = parseInt(rawYear, 10)
      }
    }

    let rawMileage = v.mileage !== undefined ? String(v.mileage).trim() : undefined
    let mileage: number | undefined = undefined

    if (rawMileage !== undefined) {
      if (rawMileage !== '') {
        mileage = Number(rawMileage)
      }
    }

    if (make === '') make = null

    if (plateNumber !== undefined) {
      if (!isValidPlateNumber(plateNumber)) {
        errors.push(PLATE_FORMAT_ERROR_MESSAGE)
      } else {
        plateNumber = normalizePlateNumber(plateNumber)
      }
    }
    if (model !== undefined && !model) errors.push('Vehicle model is required.')
    if (year !== undefined && year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
      errors.push('Invalid vehicle year.')
    }
    if (mileage !== undefined && (!Number.isInteger(mileage) || mileage < 0 || mileage > 1000000)) {
      errors.push('Enter a valid mileage (0 to 1,000,000 km).')
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, message: errors[0] }, { status: 400 })
    }

    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Check email uniqueness
      if (email !== undefined) {
        const emailCheck = await client.query(
          `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2`,
          [email, user_id]
        )
        if (emailCheck.rows.length > 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ success: false, message: 'This email is already used by another customer.' }, { status: 409 })
        }
      }

      // Check plate uniqueness
      if (plateNumber !== undefined) {
        const plateCheck = await client.query(
          `SELECT 1 FROM vehicles WHERE (LOWER(plate_number) = LOWER($1) OR LOWER(REPLACE(plate_number, ' ', '')) = LOWER($1)) AND id <> $2`,
          [plateNumber, vehicle_id]
        )
        if (plateCheck.rows.length > 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ success: false, message: 'This plate number is already registered to another vehicle.' }, { status: 409 })
        }
      }

      // Get old values
      const oldUserRes = await client.query(`SELECT first_name, last_name, contact_number, email, address FROM users WHERE id = $1`, [user_id])
      const oldVehicleRes = await client.query(`SELECT plate_number, vehicle_make, vehicle_model, vehicle_year, mileage FROM vehicles WHERE id = $1`, [vehicle_id])
      const oldUser = oldUserRes.rows[0]
      if (oldUser.address === 'None') {
        oldUser.address = null
      }
      
      const oldVehicle = oldVehicleRes.rows[0]
      if (oldVehicle.mileage != null) {
        oldVehicle.mileage = Number(oldVehicle.mileage)
      }

      const newUser = { ...oldUser }
      if (firstName !== undefined) newUser.first_name = firstName
      if (lastName !== undefined) newUser.last_name = lastName
      if (contactNumber !== undefined) newUser.contact_number = contactNumber
      if (email !== undefined) newUser.email = email
      if (address !== undefined) newUser.address = address

      const newVehicle = { ...oldVehicle }
      if (plateNumber !== undefined) newVehicle.plate_number = plateNumber
      if (make !== undefined) newVehicle.vehicle_make = make
      if (model !== undefined) newVehicle.vehicle_model = model
      if (year !== undefined) newVehicle.vehicle_year = year
      if (mileage !== undefined) newVehicle.mileage = mileage

      // Update user
      let userUpdated = false
      const userUpdateKeys = []
      const userUpdateValues = []
      let i = 1
      if (firstName !== undefined && firstName !== oldUser.first_name) { userUpdateKeys.push(`first_name = $${i++}`); userUpdateValues.push(firstName); userUpdated = true }
      if (lastName !== undefined && lastName !== oldUser.last_name) { userUpdateKeys.push(`last_name = $${i++}`); userUpdateValues.push(lastName); userUpdated = true }
      if (contactNumber !== undefined && contactNumber !== oldUser.contact_number) { userUpdateKeys.push(`contact_number = $${i++}`); userUpdateValues.push(contactNumber); userUpdated = true }
      if (email !== undefined && email !== oldUser.email) { userUpdateKeys.push(`email = $${i++}`); userUpdateValues.push(email); userUpdated = true }
      if (address !== undefined && address !== oldUser.address) { userUpdateKeys.push(`address = $${i++}`); userUpdateValues.push(address); userUpdated = true }

      if (userUpdated) {
        userUpdateValues.push(user_id)
        await client.query(`UPDATE users SET ${userUpdateKeys.join(', ')} WHERE id = $${i}`, userUpdateValues)
        await logStaffCustomerEdit(client, session.userId, user_id, 'users', user_id, oldUser, newUser)
      }

      // Update vehicle
      let vehicleUpdated = false
      const vehUpdateKeys = []
      const vehUpdateValues = []
      let j = 1
      if (plateNumber !== undefined && plateNumber !== oldVehicle.plate_number) { vehUpdateKeys.push(`plate_number = $${j++}`); vehUpdateValues.push(plateNumber); vehicleUpdated = true }
      if (make !== undefined && make !== oldVehicle.vehicle_make) { vehUpdateKeys.push(`vehicle_make = $${j++}`); vehUpdateValues.push(make); vehicleUpdated = true }
      if (model !== undefined && model !== oldVehicle.vehicle_model) { vehUpdateKeys.push(`vehicle_model = $${j++}`); vehUpdateValues.push(model); vehicleUpdated = true }
      if (year !== undefined && year !== oldVehicle.vehicle_year) { vehUpdateKeys.push(`vehicle_year = $${j++}`); vehUpdateValues.push(year); vehicleUpdated = true }
      if (mileage !== undefined && mileage !== oldVehicle.mileage) { vehUpdateKeys.push(`mileage = $${j++}`); vehUpdateValues.push(mileage); vehicleUpdated = true }

      if (vehicleUpdated) {
        vehUpdateValues.push(vehicle_id)
        await client.query(`UPDATE vehicles SET ${vehUpdateKeys.join(', ')} WHERE id = $${j}`, vehUpdateValues)
        await logStaffCustomerEdit(client, session.userId, user_id, 'vehicles', vehicle_id, oldVehicle, newVehicle)
      }

      await client.query('COMMIT')

      if (userUpdated || vehicleUpdated) {
        const emailChanged = email !== undefined && email !== oldUser.email
        const changes: { label: string; field: string; old: any; new: any }[] = [
          { label: 'Name', field: 'name', old: [oldUser.first_name, oldUser.last_name].filter(Boolean).join(' '), new: [newUser.first_name, newUser.last_name].filter(Boolean).join(' ') },
          { label: 'Contact number', field: 'contact', old: oldUser.contact_number, new: newUser.contact_number },
          { label: 'Email', field: 'email', old: oldUser.email, new: newUser.email },
          { label: 'Address', field: 'address', old: oldUser.address, new: newUser.address },
          { label: 'Vehicle plate number', field: 'plate', old: oldVehicle.plate_number, new: newVehicle.plate_number },
          { label: 'Vehicle make', field: 'make', old: oldVehicle.vehicle_make, new: newVehicle.vehicle_make },
          { label: 'Vehicle model', field: 'model', old: oldVehicle.vehicle_model, new: newVehicle.vehicle_model },
          { label: 'Vehicle year', field: 'year', old: oldVehicle.vehicle_year, new: newVehicle.vehicle_year },
          { label: 'Mileage', field: 'mileage', old: oldVehicle.mileage, new: newVehicle.mileage },
        ]

        const lines: string[] = []
        for (const c of changes) {
          if (c.old !== c.new) {
            if (emailChanged) {
              lines.push(c.label)
            } else {
              lines.push(`${c.label}: ${c.old || 'none'} → ${c.new || 'none'}`)
            }
          }
        }

        if (lines.length > 0) {
          const message = lines.join('\n') + '\n\nIf this isn\'t right, please contact the shop.'
          
          void (async () => {
            try {
              await sendJobUpdateEmail({
                to: newUser.email,
                name: [newUser.first_name, newUser.last_name].filter(Boolean).join(' ') || 'there',
                jobOrderId: jobId,
                vehicle: newVehicle.vehicle_model || 'Vehicle',
                plate: newVehicle.plate_number || '',
                title: 'Your details were updated',
                message: message
              })
            } catch (err) {
              console.error('Failed to send customer update email:', err)
            }
          })()
        }
      }

      return NextResponse.json({ success: true, customer: newUser, vehicle: newVehicle })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Update customer details error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
