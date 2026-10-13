import { supabase } from "@/integrations/supabase/client";

export type Movie = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  keywords: string;
  video_path: string;
  thumbnail_path: string;
  views: number;
  likes: number;
  created_at: string;
  thumbnailUrl?: string | undefined;
  profiles?: { display_name: string | null } | null;
};

const SELECT = "*, profiles(display_name)";

async function withThumbs(rows: Movie[]): Promise<Movie[]> {
  if (!rows.length) return rows;
  const { data } = await supabase.storage
    .from("thumbnails")
    .createSignedUrls(rows.map((r) => r.thumbnail_path), 60 * 60 * 6);
  return rows.map((r, i) => ({ ...r, thumbnailUrl: data?.[i]?.signedUrl ?? undefined }));
}

/** Google-like keyword search: every term must match title, description or keywords. */
export async function searchMovies(terms: string[], limit = 48): Promise<Movie[]> {
  let q = supabase.from("movies").select(SELECT).order("created_at", { ascending: false }).limit(limit);
  for (const raw of terms) {
    const t = raw.replace(/[%,()*]/g, "").trim();
    if (!t) continue;
    q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%,keywords.ilike.%${t}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return withThumbs((data ?? []) as Movie[]);
}

/** Any-term match, used to widen AI-expanded searches. */
export async function searchAnyTerm(terms: string[], limit = 48): Promise<Movie[]> {
  const clean = terms.map((t) => t.replace(/[%,()*]/g, "").trim()).filter(Boolean);
  if (!clean.length) return searchMovies([], limit);
  const ors = clean.flatMap((t) => [`title.ilike.%${t}%`, `description.ilike.%${t}%`, `keywords.ilike.%${t}%`]);
  const { data, error } = await supabase
    .from("movies").select(SELECT).or(ors.join(",")).order("views", { ascending: false }).limit(limit);
  if (error) throw error;
  return withThumbs((data ?? []) as Movie[]);
}

export async function getMovie(id: string) {
  const { data, error } = await supabase.from("movies").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const m = data as Movie;
  const row = data as Movie & { captions_path?: string | null; captions_lang?: string | null };
  const [{ data: v }, [withThumb], cc] = await Promise.all([
    supabase.storage.from("videos").createSignedUrl(m.video_path, 60 * 60 * 6),
    withThumbs([m]),
    row.captions_path
      ? supabase.storage.from("videos").createSignedUrl(row.captions_path, 60 * 60 * 6)
      : Promise.resolve({ data: null }),
  ]);
  return {
    ...withThumb,
    videoUrl: v?.signedUrl ?? "",
    captionsUrl: cc.data?.signedUrl ?? undefined,
    captionsLang: row.captions_lang ?? "en",
  };
}

export async function getMoviesByIds(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase.from("movies").select(SELECT).in("id", ids);
  const rows = ((data ?? []) as Movie[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return withThumbs(rows);
}

export function formatCount(n: number) {
  return Intl.NumberFormat("en", { notation: "compact" }).format(n);
}
