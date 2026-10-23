import { withDatabase } from '@/lib/postgres-store';
import { NextRequest, NextResponse } from 'next/server';
import { loadDb } from '@/lib/server-db';
import { getHondurasDateString } from '@/lib/date-utils';
import { getAuthenticatedUser } from '@/lib/api-auth';

async function handleGET(req: NextRequest) {
  try {
    const db = loadDb();
    const slug = req.nextUrl.searchParams.get('slug') || 'visitantes';
    const form =
      db.forms.find((f) => f.slug === slug) ||
      db.forms.find((f) => f.id === slug);

    if (!form) {
      return NextResponse.json({ error: 'Formulario no encontrado.' }, { status: 404 });
    }

    const authUser = getAuthenticatedUser(req);

    return NextResponse.json({
      ministryName: db.settings.ministryName,
      customLogoDataUrl: db.settings.customLogoDataUrl,
      hondurasToday: getHondurasDateString(),
      isAdminAuthenticated: Boolean(authUser),
      form: form
        ? {
            id: form.id,
            name: form.name,
            memberName: form.memberName || '',
            slug: form.slug,
            description: form.description,
            isActive: form.isActive,
          }
        : null,
    });
  } catch (error) {
    console.error('Error loading public form info:', error);
    return NextResponse.json(
      { error: 'Error al cargar la configuración del formulario.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = withDatabase(handleGET);
