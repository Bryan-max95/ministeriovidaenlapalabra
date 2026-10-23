import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { createCleanDatabase, loadDb, saveDb } from '@/lib/server-db';
import { ALL_RMS_MODULES, DatabaseSchema, RmsModuleId } from '@/lib/types';

async function handlePUT(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      customLogoDataUrl,
      adminDateOverridePin,
      subtitle,
      adminAllowedModules,
      registradorAllowedModules,
      applyToExistingAdmins,
    } = body as {
      customLogoDataUrl?: string | null;
      adminDateOverridePin?: string;
      subtitle?: string;
      adminAllowedModules?: RmsModuleId[];
      registradorAllowedModules?: RmsModuleId[];
      applyToExistingAdmins?: boolean;
    };

    const db = loadDb();
    if (customLogoDataUrl !== undefined) {
      db.settings.customLogoDataUrl = customLogoDataUrl;
    }
    if (
      typeof adminDateOverridePin === 'string' &&
      adminDateOverridePin.trim().length >= 4
    ) {
      db.settings.adminDateOverridePin = adminDateOverridePin.trim();
    }
    if (typeof subtitle === 'string' && subtitle.trim()) {
      db.settings.subtitle = subtitle.trim();
    }

    // Solo el SuperUsuario Root (bwp) puede modificar qué módulos ven los Administradores
    if (authUser.role === 'SuperUsuario') {
      const validIds = new Set(ALL_RMS_MODULES.map((m) => m.id));

      if (Array.isArray(adminAllowedModules)) {
        const cleanAdminMods = adminAllowedModules.filter((m) => validIds.has(m));
        if (cleanAdminMods.length === 0) {
          return NextResponse.json(
            {
              error:
                'Debes habilitar al menos un módulo para los Administradores.',
            },
            { status: 400 }
          );
        }
        db.settings.adminAllowedModules = cleanAdminMods;

        if (applyToExistingAdmins) {
          db.users.forEach((u) => {
            if (u.role === 'Administrador') {
              u.allowedModules = [...cleanAdminMods];
            }
          });
        }
      }

      if (Array.isArray(registradorAllowedModules)) {
        const cleanRegMods = registradorAllowedModules.filter((m) =>
          validIds.has(m)
        );
        if (cleanRegMods.length > 0) {
          db.settings.registradorAllowedModules = cleanRegMods;
          if (applyToExistingAdmins) {
            db.users.forEach((u) => {
              if (u.role === 'Registrador') {
                u.allowedModules = [...cleanRegMods];
              }
            });
          }
        }
      }
    }

    saveDb(db);
    return NextResponse.json({
      success: true,
      settings: db.settings,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Error al guardar la configuración.' },
      { status: 500 }
    );
  }
}

async function handleGET(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (
    !authUser ||
    (authUser.role !== 'SuperUsuario' && authUser.role !== 'Administrador')
  ) {
    return NextResponse.json(
      { error: 'Solo el Super Usuario o un Administrador pueden descargar respaldos.' },
      { status: 403 }
    );
  }

  const db = loadDb();
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    ministry: 'MINISTERIO VIDA EN LA PALABRA',
    backup: db,
  });
}

async function handlePOST(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (
    !authUser ||
    (authUser.role !== 'SuperUsuario' && authUser.role !== 'Administrador')
  ) {
    return NextResponse.json(
      { error: 'No autorizado para restaurar copias de seguridad.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const backup = (body.backup || body) as DatabaseSchema;

    if (
      !backup ||
      !Array.isArray(backup.persons) ||
      !Array.isArray(backup.visits) ||
      !Array.isArray(backup.forms)
    ) {
      return NextResponse.json(
        { error: 'El archivo de respaldo no tiene una estructura válida.' },
        { status: 400 }
      );
    }

    const currentDb = loadDb();
    const mergedDb: DatabaseSchema = {
      persons: backup.persons,
      visits: backup.visits,
      forms: backup.forms,
      users: Array.isArray(backup.users) ? backup.users : currentDb.users,
      settings: backup.settings || currentDb.settings,
    };

    saveDb(mergedDb);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: 'Error al restaurar la copia de seguridad.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Limpiar todos los registros de la base de datos (Solo SuperUsuario bwp)
 */
async function handleDELETE(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser || authUser.role !== 'SuperUsuario') {
    return NextResponse.json(
      { error: 'Solo el Super Usuario Root (bwp) puede reiniciar la base de datos.' },
      { status: 403 }
    );
  }

  const clean = createCleanDatabase();
  saveDb(clean);
  return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const PUT = withDatabase(handlePUT);
export const GET = withDatabase(handleGET);
export const POST = withDatabase(handlePOST);
export const DELETE = withDatabase(handleDELETE);
