import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  getRootCredentials,
  getRootSafeUser,
  loadDb,
  toSafeUser,
  verifyPassword,
} from '@/lib/server-db';

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Ingresa tu usuario y contraseña.' },
        { status: 400 }
      );
    }

    const normalizedUsername = username.trim().toLowerCase();
    const rootCreds = getRootCredentials();

    // 1. Verificar si es el Super Usuario Root (bwp) definido en .env
    if (
      normalizedUsername === rootCreds.username.toLowerCase() &&
      password === rootCreds.password
    ) {
      const rootUser = getRootSafeUser();
      const token = createSessionToken(rootUser);
      const response = NextResponse.json({
        user: rootUser,
        token,
      });

      response.cookies.set('mvp_rms_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    // 2. Verificar usuarios registrados en la base de datos
    const db = loadDb();
    const user = db.users.find(
      (u) => u.username.toLowerCase() === normalizedUsername
    );

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Esta cuenta de usuario se encuentra desactivada.' },
        { status: 403 }
      );
    }

    const safeUser = toSafeUser(user, db.settings);
    const token = createSessionToken(safeUser);

    const response = NextResponse.json({
      user: safeUser,
      token,
    });

    response.cookies.set('mvp_rms_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error al iniciar sesión en el panel.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withDatabase(handlePOST);
