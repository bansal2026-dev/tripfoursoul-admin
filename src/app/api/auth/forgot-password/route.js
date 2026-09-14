import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Secure 6-digit OTP using Node built-in crypto
const generateOTP = () => randomInt(100000, 1000000).toString();

let schemaReady;
const ensureOTPColumns = () => {
  if (!schemaReady) {
    schemaReady = Promise.all([
      db.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)'),
      db.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP'),
    ]).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
};

// Create SMTP transporter from env variables
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

const sendOTPEmail = async (toEmail, otp) => {
  const transporter = createTransporter();
  if (!transporter) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"TripForSoul Admin" <${from}>`,
    to: toEmail,
    subject: 'Your Password Reset OTP — TripForSoul Admin',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;">
        <h2 style="color:#24564C;margin-bottom:8px;">Password Reset OTP</h2>
        <p style="color:#555;">Use the OTP below to reset your TripForSoul admin password:</p>
        <div style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#24564C;background:#DCE8DF;padding:20px;border-radius:10px;text-align:center;margin:20px 0;">
          ${otp}
        </div>
        <p style="color:#888;font-size:13px;">
          Valid for <strong>10 minutes</strong>. One-time use only.<br/>
          If you did not request this, ignore this email.
        </p>
      </div>
    `,
  });

  return true;
};

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    try {
      await ensureOTPColumns();
    } catch (e) {
      console.warn('Could not ensure OTP columns in PG:', e.message);
    }

    let targetAdmin = null;

    // 1. Try PostgreSQL
    try {
      const admins = await db.query(
        'SELECT id, email FROM admins WHERE LOWER(email) = LOWER($1) AND (is_active IS NOT FALSE)',
        [email.trim()]
      );
      if (admins.length > 0) targetAdmin = admins[0];
    } catch (pgErr) {
      console.warn('PostgreSQL forgot password lookup error:', pgErr.message);
    }

    // 2. Try JSON fallback if not found in PG
    if (!targetAdmin) {
      try {
        const jsonPath = path.join(process.cwd(), 'database.json');
        if (fs.existsSync(jsonPath)) {
          const fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          const found = (fileData.admins || []).find(
            (a) => String(a.email || '').toLowerCase() === email.trim().toLowerCase()
          );
          if (found) targetAdmin = found;
        }
      } catch (jsonErr) {
        console.warn('JSON lookup error:', jsonErr.message);
      }
    }

    if (!targetAdmin) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists for that email, an OTP has been sent.',
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    // Save OTP to PostgreSQL
    if (targetAdmin.id) {
      try {
        await db.update('admins', targetAdmin.id, {
          otp_code: otp,
          otp_expires_at: expiresAt,
        });
      } catch (pgUpdateErr) {
        console.warn('Could not save OTP to PG:', pgUpdateErr.message);
      }
    }

    // Also sync OTP to database.json
    try {
      const jsonPath = path.join(process.cwd(), 'database.json');
      if (fs.existsSync(jsonPath)) {
        const fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (Array.isArray(fileData.admins)) {
          fileData.admins = fileData.admins.map((a) => {
            if (String(a.email || '').toLowerCase() === email.trim().toLowerCase()) {
              return { ...a, otp_code: otp, otp_expires_at: expiresAt };
            }
            return a;
          });
          fs.writeFileSync(jsonPath, JSON.stringify(fileData, null, 2));
        }
      }
    } catch (jsonSaveErr) {
      console.warn('Could not sync OTP to database.json:', jsonSaveErr.message);
    }

    const emailSent = await sendOTPEmail(targetAdmin.email, otp).catch((err) => {
      console.error('SMTP error:', err.message);
      return false;
    });

    if (!emailSent) {
      // SMTP not configured — show OTP on screen
      return NextResponse.json({
        success: true,
        otp,
        noEmail: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${admins[0].email}. Valid for 10 minutes.`,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Unable to send OTP. Please try again.' }, { status: 500 });
  }
}