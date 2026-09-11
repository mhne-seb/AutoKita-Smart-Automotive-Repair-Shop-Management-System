import nodemailer from 'nodemailer'

//Gmail SMTP. GMAIL_APP_PASSWORD is a google "app password", not the account password.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
})

export async function sendTempPasswordEmail(opts: {
    to: string
    name: string
    tempPassword: string
    booking?: {
        reference: string
        vehicle: string
        serviceMode: string
        details: string
    }
}) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const loginUrl = `${base}/login`
    const b = opts.booking
    
    const summaryText = b 
    ? `\nBooking summary\n` +
        `Reference: ${b.reference}\n` +
        `Vehicle: ${b.vehicle}\n` +
        `Service mode: ${b.serviceMode}\n` +
        `Details: ${b.details}\n`
        : ''
    
    const summaryHtml = b
        ? `<h3 style="color:#1e3a5f;margin-top:24px">Booking summary</h3>
           <table style="margin:8px 0;border-collapse:collapse;font-size:14px">
             <tr><td style="padding:4px 12px 4px 0;color:#666">Reference</td><td style="font-weight:600">${b.reference}</td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Vehicle</td><td style="font-weight:600">${b.vehicle}</td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Service mode</td><td style="font-weight:600">${b.serviceMode}</td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Details</td><td style="font-weight:600">${b.details}</td></tr>
           </table>`
        : ''

    await transporter.sendMail({
        from: `"AutoKita" <${process.env.GMAIL_USER}>`,
        to: opts.to,
        subject: 'Your AutoKita account - temporary password',
        text:
            `HI ${opts.name}, \n\n` +
            `We created an AutoKita account for you so you can track your booking. \n\n` +
            `Email: ${opts.to}\n` +
            `Temporary password: ${opts.tempPassword}\n\n` +
            `Log in: ${loginUrl}\n\n` +
            summaryText + `\n` +
            'Please change your password after your first login. \n\n— AutoKita',
        html: `
          <div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:auto;color:#111">
        <h2 style="color:#1e3a5f">Welcome to AutoKita</h2>
        <p>Hi ${opts.name},</p>
        <p>We created an account for you so you can track your booking. Use these details to log in:</p>
        <table style="margin:16px 0;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="font-weight:600">${opts.to}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Temp password</td><td style="font-weight:600;font-family:monospace">${opts.tempPassword}</td></tr>
        </table>
        <a href="${loginUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Log in to AutoKita</a>
        ${summaryHtml}
        <p style="margin-top:20px;font-size:13px;color:#666">Please change your password after your first login.</p>
      </div>
        `,
    })
}