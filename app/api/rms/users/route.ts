import { withDatabase } from '@/lib/postgres-store';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  getRootCredentials,
  hashPassword,
  loadDb,
  saveDb,
  toSafeUser,
} from '@/lib/server-db';
import { ALL_RMS_MODULES, RmsModuleId, UserAccount, UserRole } from '@/lib/types';

async function handlePOST(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (
    !authUser ||
    (authUser.role !== 'SuperUsuario' && authUser.role !== 'Administrador')
  ) {
    return NextResponse.json(
      { error: 'Solo el Super Usuario o un Administrador pueden crear cuentas.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { username, fullName, password, role, allowedModules } = body as {
      username?: string;
      fullName?: string;
      password?: string;
      role?: UserRole;
      allowedModules?: RmsModuleId[];
    };

    if (!username || username.trim().length < 3) {
      return NextResponse.json(
        { error: 'El nombre de usuario debe tener al menos 3 caracteres.' },
        { status: 400 }
      );
    }

    if (!fullName || fullName.trim().length < 3) {
      return NextResponse.json(
        { error: 'Ingresa el nombre completo del responsable.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const db = loadDb();
    const cleanUsername = username.trim().toLowerCase();
    const rootCreds = getRootCredentials();

    if (
      cleanUsername === rootCreds.username.toLowerCase() ||
      db.users.some((u) => u.username.toLowerCase() === cleanUsername)
    ) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese identificador.' },
        { status: 409 }
      );
    }

    const assignedRole: UserRole =
      role === 'Administrador' ? 'Administrador' : 'Registrador';

    const defaultModulesForRole =
      assignedRole === 'Administrador'
        ? db.settings.adminAllowedModules
        : db.settings.registradorAllowedModules;

    const validModuleIds = new Set(ALL_RMS_MODULES.map((m) => m.id));
    const sanitizedModules = Array.isArray(allowedModules)
      ? allowedModules.filter((m) => validModuleIds.has(m))
      : defaultModulesForRole;

    const newUser: UserAccount = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      username: cleanUsername,
      fullName: fullName.trim(),
      passwordHash: hashPassword(password),
      role: assignedRole,
      isActive: true,
      allowedModules:
        sanitizedModules.length > 0 ? sanitizedModules : defaultModulesForRole,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDb(db);

    return NextResponse.json({
      success: true,
      user: toSafeUser(newUser, db.settings),
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Error al crear el usuario.' },
      { status: 500 }
    );
  }
}

async function handlePATCH(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (
    !authUser ||
    (authUser.role !== 'SuperUsuario' && authUser.role !== 'Administrador')
  ) {
    return NextResponse.json(
      { error: 'Permisos insuficientes para modificar usuarios.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, isActive, role, newPassword, fullName, allowedModules } =
      body as {
        id?: string;
        isActive?: boolean;
        role?: UserRole;
        newPassword?: string;
        fullName?: string;
        allowedModules?: RmsModuleId[];
      };

    const db = loadDb();
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }

    if (role === 'Administrador' || role === 'Registrador') {
      user.role = role;
    }

    if (typeof fullName === 'string' && fullName.trim().length >= 3) {
      user.fullName = fullName.trim();
    }

    if (typeof newPassword === 'string' && newPassword.trim().length >= 6) {
      user.passwordHash = hashPassword(newPassword.trim());
    }

    if (Array.isArray(allowedModules) && authUser.role === 'SuperUsuario') {
      const validModuleIds = new Set(ALL_RMS_MODULES.map((m) => m.id));
      const filtered = allowedModules.filter((m) => validModuleIds.has(m));
      if (filtered.length === 0) {
        return NextResponse.json(
          { error: 'Debes habilitar al menos un módulo para el usuario.' },
          { status: 400 }
        );
      }
      user.allowedModules = filtered;
    }

    saveDb(db);
    return NextResponse.json({
      success: true,
      user: toSafeUser(user, db.settings),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el usuario.' },
      { status: 500 }
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser || authUser.role !== 'SuperUsuario') {
    return NextResponse.json(
      { error: 'Solo el Super Usuario Root (bwp) puede eliminar cuentas de usuario.' },
      { status: 403 }
    );
  }

  try {
    const userId = req.nextUrl.searchParams.get('id');
    if (!userId) {
      return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
    }

    const db = loadDb();
    db.users = db.users.filter((u) => u.id !== userId);
    saveDb(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el usuario.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withDatabase(handlePOST);
export const PATCH = withDatabase(handlePATCH);
export const DELETE = withDatabase(handleDELETE);
