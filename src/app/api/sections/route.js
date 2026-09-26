import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sections = await db.query('SELECT * FROM homepage_sections');
    sections.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return NextResponse.json({ sections });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    
    // Support both single object { id, is_visible, sort_order } and array { sections: [...] }
    let sectionsToUpdate = [];
    if (Array.isArray(body.sections)) {
      sectionsToUpdate = body.sections;
    } else if (body.id !== undefined) {
      sectionsToUpdate = [body];
    }

    if (Array.isArray(body.sections)) {
      const sortOrders = body.sections.map((section) => Number(section.sort_order));
      if (sortOrders.some((sortOrder) => !Number.isInteger(sortOrder) || sortOrder < 1)) {
        return NextResponse.json({ error: 'Every homepage section must have a valid order.' }, { status: 400 });
      }
      if (new Set(sortOrders).size !== sortOrders.length) {
        return NextResponse.json({ error: 'Homepage section order values must be unique.' }, { status: 400 });
      }
    }
    
    for (const section of sectionsToUpdate) {
      const updateData = {};
      if (section.is_visible !== undefined) {
        updateData.is_visible = (
          section.is_visible === true ||
          section.is_visible === 1 ||
          section.is_visible === '1' ||
          section.is_visible === 'true'
        );
      }
      if (section.sort_order !== undefined) updateData.sort_order = Number(section.sort_order);
      if (section.section_name !== undefined) updateData.section_name = section.section_name;
      if (section.section_key !== undefined) updateData.section_key = section.section_key;
      updateData.updated_at = new Date();
      await db.update('homepage_sections', section.id, updateData);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
