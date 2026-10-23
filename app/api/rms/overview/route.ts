import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  computeDashboardStats,
  getAllPersonsWithVisits,
  getAllVisitsWithPersons,
  loadDb,
  toSafeUser,
} from '@/lib/server-db';

async function handleGET(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: 'No autorizado. Inicia sesión en el panel administrativo.' },
      { status: 401 }
    );
  }

  try {
    const db = loadDb();
    const stats = computeDashboardStats(db);
    const persons = getAllPersonsWithVisits(db);
    const visits = getAllVisitsWithPersons(db);
    const users = db.users.map((u) => toSafeUser(u, db.settings));

    return NextResponse.json({
      currentUser: authUser,
      stats,
      persons,
      visits,
      forms: db.forms,
      users,
      settings: db.settings,
    });
  } catch (error) {
    console.error('Error fetching RMS overview:', error);
    return NextResponse.json(
      { error: 'Error al cargar los datos del panel administrativo.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = withDatabase(handleGET);
