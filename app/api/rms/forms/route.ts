import { withDatabase } from '@/lib/postgres-store';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { loadDb, saveDb } from '@/lib/server-db';
import { FormConfig } from '@/lib/types';

async function handlePOST(req: NextRequest) {
  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, memberName, slug, description } = body as {
      name?: string;
      memberName?: string;
      slug?: string;
      description?: string;
    };

    const effectiveMember = (memberName || name || '').trim();
    if (!effectiveMember || effectiveMember.length < 2) {
      return NextResponse.json(
        { error: 'Ingresa el nombre del miembro de la iglesia o del enlace.' },
        { status: 400 }
      );
    }

    const effectiveTitle =
      name && name.trim().length >= 3
        ? name.trim()
        : `Enlace de Invitación — ${effectiveMember}`;

    const cleanSlug = (slug || `invita-${effectiveMember}`)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleanSlug) {
      return NextResponse.json(
        { error: 'El identificador de enlace no es válido.' },
        { status: 400 }
      );
    }

    const db = loadDb();
    if (db.forms.some((f) => f.slug === cleanSlug)) {
      return NextResponse.json(
        { error: 'Ya existe un enlace con ese identificador.' },
        { status: 409 }
      );
    }

    const newForm: FormConfig = {
      id: `frm-${crypto.randomUUID().slice(0, 8)}`,
      name: effectiveTitle,
      memberName: effectiveMember,
      slug: cleanSlug,
      description: (
        description ||
        `Enlace para que ${effectiveMember} registre a los amigos que invita a la iglesia.`
      ).trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    db.forms.push(newForm);
    saveDb(db);

    return NextResponse.json({ success: true, form: newForm });
  } catch (error) {
    console.error('Error creating form:', error);
    return NextResponse.json(
      { error: 'Error al crear el enlace para el miembro.' },
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
    const { id, isActive, name, memberName, description } = body as {
      id?: string;
      isActive?: boolean;
      name?: string;
      memberName?: string;
      description?: string;
    };

    const db = loadDb();
    const form = db.forms.find((f) => f.id === id);
    if (!form) {
      return NextResponse.json(
        { error: 'Enlace no encontrado.' },
        { status: 404 }
      );
    }

    if (typeof isActive === 'boolean') form.isActive = isActive;
    if (typeof name === 'string' && name.trim()) form.name = name.trim();
    if (typeof memberName === 'string' && memberName.trim()) {
      form.memberName = memberName.trim();
    }
    if (typeof description === 'string') form.description = description.trim();

    saveDb(db);
    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json(
      { error: 'Error al actualizar el enlace.' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = withDatabase(handlePOST);
export const PATCH = withDatabase(handlePATCH);
