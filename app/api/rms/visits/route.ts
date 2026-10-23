import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import {
  loadDb,
  registerVisitRecord,
  saveDb,
  updateVisitArrivalStatus,
} from '@/lib/server-db';
import { getHondurasDateString, validatePhoneNumber } from '@/lib/date-utils';
import { VisitAttendanceStatus } from '@/lib/types';

async function handlePOST(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      personId,
      fullName,
      phone,
      address,
      visitDate,
      status,
      invitedByMember,
      formId,
    } = body as {
      personId?: string;
      fullName?: string;
      phone?: string;
      address?: string;
      visitDate?: string;
      status?: VisitAttendanceStatus;
      invitedByMember?: string;
      formId?: string;
    };

    const db = loadDb();
    let effectiveName = (fullName || '').trim();
    let effectivePhone = (phone || '').trim();
    let effectiveAddress = (address || '').trim();

    if (personId) {
      const existingPerson = db.persons.find((p) => p.id === personId);
      if (!existingPerson) {
        return NextResponse.json(
          { error: 'La persona seleccionada no existe.' },
          { status: 404 }
        );
      }
      effectiveName = existingPerson.fullName;
      effectivePhone = existingPerson.phone;
      effectiveAddress = effectiveAddress || existingPerson.address || '';
    } else {
      if (!effectiveName || effectiveName.length < 2) {
        return NextResponse.json(
          { error: 'El nombre completo es obligatorio.' },
          { status: 400 }
        );
      }
      const phoneValidation = validatePhoneNumber(effectivePhone);
      if (!phoneValidation.valid) {
        return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
      }
    }

    const effectiveDate =
      visitDate && /^\d{4}-\d{2}-\d{2}$/.test(visitDate)
        ? visitDate
        : getHondurasDateString();

    const result = registerVisitRecord({
      personId,
      fullName: effectiveName,
      phone: effectivePhone,
      address: effectiveAddress,
      visitDate: effectiveDate,
      status: status === 'invited' ? 'invited' : 'attended',
      invitedByMember: (invitedByMember || '').trim() || authUser.fullName,
      formId,
      source: 'admin_panel',
      registeredByUser: authUser,
    });

    return NextResponse.json({
      success: true,
      person: result.person,
      visit: result.visit,
      isReturningVisitor: result.isReturningVisitor,
      visitNumber: result.visitNumber,
    });
  } catch (error) {
    console.error('Error registering visit from panel:', error);
    return NextResponse.json(
      { error: 'Error al registrar la invitación o visita.' },
      { status: 500 }
    );
  }
}

async function handlePATCH(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { visitId, status } = body as {
      visitId?: string;
      status?: VisitAttendanceStatus;
    };

    if (!visitId || (status !== 'invited' && status !== 'attended')) {
      return NextResponse.json(
        { error: 'Datos de verificación de llegada incompletos.' },
        { status: 400 }
      );
    }

    const updated = updateVisitArrivalStatus({
      visitId,
      status,
      verifiedByUser: authUser,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'No se encontró el registro de invitación.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      visit: updated,
    });
  } catch (error) {
    console.error('Error updating visit arrival status:', error);
    return NextResponse.json(
      { error: 'Error al verificar la llegada del invitado.' },
      { status: 500 }
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const visitId = req.nextUrl.searchParams.get('visitId');
    if (!visitId) {
      return NextResponse.json(
        { error: 'ID de visita requerido.' },
        { status: 400 }
      );
    }

    const db = loadDb();
    const visitIndex = db.visits.findIndex((v) => v.id === visitId);
    if (visitIndex === -1) {
      return NextResponse.json(
        { error: 'Visita no encontrada.' },
        { status: 404 }
      );
    }

    db.visits.splice(visitIndex, 1);
    saveDb(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting visit:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la visita.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withDatabase(handlePOST);
export const PATCH = withDatabase(handlePATCH);
export const DELETE = withDatabase(handleDELETE);
