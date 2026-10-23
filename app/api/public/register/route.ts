import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import { loadDb, registerVisitRecord } from '@/lib/server-db';
import { getHondurasDateString, validatePhoneNumber } from '@/lib/date-utils';
import { getAuthenticatedUser } from '@/lib/api-auth';

async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      phone,
      address,
      visitDate,
      formSlug,
      invitedByMember,
      adminPin,
    } = body as {
      fullName?: string;
      phone?: string;
      address?: string;
      visitDate?: string;
      formSlug?: string;
      invitedByMember?: string;
      adminPin?: string;
    };

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Por favor ingresa el nombre completo del amigo o hermano invitado.' },
        { status: 400 }
      );
    }

    if (fullName.trim().length > 160) {
      return NextResponse.json(
        { error: 'El nombre ingresado excede la longitud permitida.' },
        { status: 400 }
      );
    }

    const phoneValidation = validatePhoneNumber(phone || '');
    if (!phoneValidation.valid) {
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 });
    }

    if (!address || typeof address !== 'string' || address.trim().length < 2) {
      return NextResponse.json(
        { error: 'Por favor indica dónde vive la persona (colonia, barrio o dirección).' },
        { status: 400 }
      );
    }

    const db = loadDb();
    const matchedForm =
      db.forms.find((f) => f.slug === (formSlug || 'visitantes') || f.id === formSlug);

    if (!matchedForm) {
      return NextResponse.json({ error: 'Formulario no encontrado.' }, { status: 404 });
    }

    if (matchedForm && !matchedForm.isActive) {
      return NextResponse.json(
        {
          error:
            'Este enlace de formulario se encuentra desactivado temporalmente por la administración.',
        },
        { status: 403 }
      );
    }

    const effectiveInviter =
      (invitedByMember || '').trim() || matchedForm?.memberName || '';

    if (!effectiveInviter) {
      return NextResponse.json(
        { error: 'Por favor ingresa el nombre de quien lo invita.' },
        { status: 400 }
      );
    }

    const hnToday = getHondurasDateString();
    let effectiveDate = hnToday;

    if (visitDate && visitDate !== hnToday) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
        return NextResponse.json(
          { error: 'El formato de la fecha no es válido.' },
          { status: 400 }
        );
      }

      if (visitDate < hnToday) {
        const authUser = getAuthenticatedUser(req);
        const isPinValid =
          adminPin && adminPin.trim() === db.settings.adminDateOverridePin;

        if (!authUser && !isPinValid) {
          return NextResponse.json(
            {
              error:
                'Para registrar una fecha anterior se requiere autorización de administrador.',
            },
            { status: 403 }
          );
        }
      }
      effectiveDate = visitDate;
    }

    const result = registerVisitRecord({
      fullName: fullName.trim(),
      phone: (phone || '').trim(),
      address: address.trim(),
      visitDate: effectiveDate,
      status: 'invited',
      invitedByMember: effectiveInviter,
      formId: matchedForm?.id || 'frm-principal',
      source: 'public_form',
      registeredByUser: null,
    });

    return NextResponse.json({
      success: true,
      message:
        'Invitado registrado correctamente. Gracias por ayudarnos a preparar la bienvenida.',
      registration: {
        visitDate: result.visit.visitDate,
        registeredAt: result.visit.registeredAt,
        status: result.visit.status,
      },
    });
  } catch (error) {
    console.error('Error registering public visit:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al procesar el registro. Intenta nuevamente.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withDatabase(handlePOST);
