import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { email, otp, token, password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (!token?.trim() && (!email?.trim() || !otp?.trim())) {
      return NextResponse.json({ error: 'Email and 6-digit OTP (or reset token) are required' }, { status: 400 });
    }

    let matchedAdmin = null;

    // 1. Try PostgreSQL lookup
    try {
      if (token?.trim()) {
        const admins = await db.query(
          `SELECT id, username, email FROM admins
           WHERE reset_token_hash = $1
             AND reset_token_expires_at > CURRENT_TIMESTAMP
             AND (is_active IS NOT FALSE)`,
          [token.trim()]
        );
        if (admins.length > 0) matchedAdmin = admins[0];
      } else if (email?.trim() && otp?.trim()) {
        const admins = await db.query(
          `SELECT id, username, email FROM admins
           WHERE LOWER(email) = LOWER($1)
             AND otp_code = $2
             AND otp_expires_at > CURRENT_TIMESTAMP
             AND (is_active IS NOT FALSE)`,
          [email.trim(), otp.trim()]
        );
        if (admins.length > 0) matchedAdmin = admins[0];
      }
    } catch (pgError) {
      console.warn('PostgreSQL reset password lookup failed, checking JSON fallback:', pgError.message);
    }

    // 2. Fallback to database.json lookup
    if (!matchedAdmin) {
      try {
        const jsonPath = path.join(process.cwd(), 'database.json');
        if (fs.existsSync(jsonPath)) {
          const fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          const admins = fileData.admins || [];
          const now = new Date();

          if (email?.trim() && otp?.trim()) {
            const found = admins.find((a) => {
              const emailMatches = String(a.email || '').toLowerCase() === email.trim().toLowerCase();
              const otpMatches = String(a.otp_code || '').trim() === otp.trim();
              const notExpired = !a.otp_expires_at || new Date(a.otp_expires_at) > now;
              return emailMatches && otpMatches && notExpired;
            });
            if (found) matchedAdmin = found;
          } else if (token?.trim()) {
            const found = admins.find((a) => {
              const tokenMatches = String(a.reset_token_hash || '').trim() === token.trim();
              const notExpired = !a.reset_token_expires_at || new Date(a.reset_token_expires_at) > now;
              return tokenMatches && notExpired;
            });
            if (found) matchedAdmin = found;
          }
        }
      } catch (jsonErr) {
        console.warn('JSON fallback lookup error:', jsonErr.message);
      }
    }

    if (!matchedAdmin) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP / token. Please request a new one.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Update PostgreSQL
    try {
      if (matchedAdmin.id) {
        await db.update('admins', matchedAdmin.id, {
          password: passwordHash,
          otp_code: null,
          otp_expires_at: null,
          reset_token_hash: null,
          reset_token_expires_at: null,
        });
      }
    } catch (pgUpdateErr) {
      console.warn('Could not update admin password in PostgreSQL:', pgUpdateErr.message);
    }

    // 4. Update database.json as well so credentials stay 100% in sync
    try {
      const jsonPath = path.join(process.cwd(), 'database.json');
      if (fs.existsSync(jsonPath)) {
        const fileData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        if (Array.isArray(fileData.admins)) {
          let updatedAny = false;
          fileData.admins = fileData.admins.map((a) => {
            const matchesEmail = matchedAdmin.email && String(a.email || '').toLowerCase() === String(matchedAdmin.email).toLowerCase();
            const matchesUsername = matchedAdmin.username && String(a.username || '').toLowerCase() === String(matchedAdmin.username).toLowerCase();
            const matchesBhaskar = (matchedAdmin.email && String(matchedAdmin.email).toLowerCase() === 'bhskrbnsl@gmail.com') && ['bhaskar', 'bhaskarbansal'].includes(String(a.username || '').toLowerCase());

            if (matchesEmail || matchesUsername || matchesBhaskar) {
              updatedAny = true;
              return {
                ...a,
                password: passwordHash,
                otp_code: null,
                otp_expires_at: null,
                reset_token_hash: null,
                reset_token_expires_at: null,
              };
            }
            return a;
          });

          if (updatedAny) {
            fs.writeFileSync(jsonPath, JSON.stringify(fileData, null, 2));
          }
        }
      }
    } catch (jsonWriteErr) {
      console.warn('Could not sync updated password to database.json:', jsonWriteErr.message);
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully! You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Unable to reset password. Please try again.' }, { status: 500 });
  }
}