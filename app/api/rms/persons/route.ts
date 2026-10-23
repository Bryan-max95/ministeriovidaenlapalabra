import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { buildPersonWithVisits, loadDb, saveDb } from '@/lib/server-db';
import {
  formatPhoneDisplay,
  normalizePhoneNumber,
  validatePhoneNumber,
} from '@/lib/date-utils';

async function handlePUT(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, fullName, phone, address, invitedByMember } = body as {
      id?: string;
      fullName?: string;
      phone?: string;
      address?: string;
      invitedByMember?: string;
    };

    if (!id) {
      return NextResponse.json({ error: 'ID de persona requerido.' }, { status: 400 });
    }

    if (!fullName || fullName.trim().length < 2) {
      return NextResponse.json(
        { error: 'El nombre completo es obligatorio.' },
        { status: 400 }
      );
    }

    const phoneValidation = validatePhoneNumber(phone || '');
    if (!phoneValidation.valid) {
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
    }

    const db = loadDb();
    const person = db.persons.find((p) => p.id === id);
    if (!person) {
      return NextResponse.json({ error: 'Persona no encontrada.' }, { status: 404 });
    }

    const normPhone = normalizePhoneNumber(phone!);
    const duplicateOther = db.persons.find(
      (p) => p.id !== id && p.normalizedPhone === normPhone
    );
    if (duplicateOther) {
      return NextResponse.json(
        {
          error: `Ese número telefónico ya pertenece a otra persona registrada (${duplicateOther.fullName}).`,
        },
        { status: 409 }
      );
    }

    person.fullName = fullName.trim().replace(/\s+/g, ' ');
    person.phone = formatPhoneDisplay(phone!);
    person.normalizedPhone = normPhone;
    if (typeof address === 'string') {
      person.address = address.trim().replace(/\s+/g, ' ');
    }
    if (typeof invitedByMember === 'string' && invitedByMember.trim()) {
      person.invitedByMember = invitedByMember.trim().replace(/\s+/g, ' ');
    }

    saveDb(db);

    return NextResponse.json({
      success: true,
      person: buildPersonWithVisits(person, db.visits),
    });
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { error: 'Error al actualizar los datos de la persona.' },
      { status: 500 }
    );
  }
}

async function handleDELETE(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (
    !authUser ||
    (authUser.role !== 'SuperUsuario' && authUser.role !== 'Administrador')
  ) {
    return NextResponse.json(
      { error: 'Solo el Super Usuario o un Administrador pueden eliminar fichas.' },
      { status: 403 }
    );
  }

  try {
    const personId = req.nextUrl.searchParams.get('id');
    if (!personId) {
      return NextResponse.json({ error: 'ID requerido.' }, { status: 400 });
    }

    const db = loadDb();
    db.persons = db.persons.filter((p) => p.id !== personId);
    db.visits = db.visits.filter((v) => v.personId !== personId);
    saveDb(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el registro.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const PUT = withDatabase(handlePUT);
export const DELETE = withDatabase(handleDELETE);
