async function getSupabase() {
  return (await import('@/lib/supabase')).supabase;
}

export const profileAvatarQueryKey = (path: string | null) => ['profile-avatar', path] as const;

export async function resolveProfileAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage.from('profile-media').createSignedUrl(path, 900);
  if (error) throw error;
  return data.signedUrl;
}
