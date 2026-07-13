import { NextRequest, NextResponse } from 'next/server';
import { db, projects } from '@/lib/db';

export async function GET() {
  const rows = await db.select().from(projects).orderBy(projects.kind, projects.createdAt).limit(200);
  return NextResponse.json({ projects: rows });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const name = body.name.trim();
  const kind = body.kind === 'project' ? 'project' : 'area';
  const values = {
    name,
    kind,
    // only projects nest, and only one level deep
    parentId: kind === 'project' && typeof body.parentId === 'string' ? body.parentId : null,
  };
  try {
    const [row] = await db
      .insert(projects)
      .values({ ...values, slug: slugify(name) })
      .returning();
    return NextResponse.json({ project: row });
  } catch {
    // slug collision — suffix and retry once
    const [row] = await db
      .insert(projects)
      .values({ ...values, slug: `${slugify(name)}-${Date.now().toString(36).slice(-4)}` })
      .returning();
    return NextResponse.json({ project: row });
  }
}
