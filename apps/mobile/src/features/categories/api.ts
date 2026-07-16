import type { Category } from '@casaticket/types';

import { supabase } from '@/lib/supabase';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listActiveCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapCategory(row as CategoryRow));
}
