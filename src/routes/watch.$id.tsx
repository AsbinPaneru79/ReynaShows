import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MovieCard } from "@/components/MovieCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { runAi } from "@/lib/ai.functions";
import { formatCount, getMovie, getMoviesByIds, searchMovies, type Movie } from "@/lib/movies";

export const Route = createFileRoute("/watch/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Watch — ReynaShows" },
      { name: "description", content: "Watch movies shared by the ReynaShows community." },
      { property: "og:title", content: "Watch — ReynaShows" },
      { property: "og:description", content: "Watch movies shared by the ReynaShows community." },
    ],
  }),
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const ai = useServerFn(runAi);
  const { data: movie, isLoading } = useQuery({ queryKey: ["movie", id], queryFn: () => getMovie(id) });
  const [views, setViews] = useState<number | null>(null);
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [recs, setRecs] = useState<Movie[]>([]);
  const counted = useRef<string | null>(null);

  useEffect(() => {
    if (counted.current === id) return;
    counted.current = id;
    supabase.rpc("increment_view", { _movie_id: id }).then(({ data }) => {
      if (typeof data === "number") setViews(data);
    });
  }, [id]);

  useEffect(() => {
    setLikes(null);
    if (!user) { setLiked(false); return; }
    supabase.from("movie_likes").select("movie_id").eq("movie_id", id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [id, user]);

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    (async () => {
      const pool = (await searchMovies([], 40)).filter((m) => m.id !== movie.id);
      if (user && pool.length > 6) {
        const r = await ai({
          data: {
            mode: "recommend",
            current: { title: movie.title, description: movie.description },
            candidates: pool.map((m) => ({ id: m.id, title: m.title, keywords: m.keywords })),
          },
        }).catch(() => null);
        const ids = r?.ok ? ((JSON.parse(r.result) as { ids?: string[] }).ids ?? []) : [];
        if (ids.length) {
          const picked = await getMoviesByIds(ids.filter((i) => pool.some((p) => p.id === i)));
          if (!cancelled && picked.length) { setRecs(picked); return; }
        }
      }
      if (!cancelled) setRecs(pool.slice(0, 6));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie?.id, user?.id]);

  async function toggleLike() {
    if (!user) { toast("Log in to like movies"); return; }
    const { data, error } = await supabase.rpc("toggle_like", { _movie_id: id });
    if (error) { toast.error(error.message); return; }
    const r = data as { liked: boolean; likes: number };
    setLiked(r.liked);
    setLikes(r.likes);
  }

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10 text-muted-foreground">Loading…</div>;
  if (!movie)
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="text-3xl">Movie not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary">Back home</Link>
      </div>
    );

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <div>
        <video
          key={movie.videoUrl}
          src={movie.videoUrl}
          poster={movie.thumbnailUrl}
          controls
          autoPlay
          crossOrigin="anonymous"
          className="aspect-video w-full rounded-xl bg-card"
        >
          {movie.captionsUrl && (
            <track kind="subtitles" src={movie.captionsUrl} srcLang={movie.captionsLang} label="CC" default />
          )}
        </video>
        <h1 className="mt-4 text-3xl font-semibold">{movie.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{movie.profiles?.display_name ?? "Unknown"}</span>
            {" · "}{new Date(movie.created_at ?? Date.now()).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" /> {formatCount(views ?? movie.views ?? 0)} views
            </span>
            <Button variant={liked ? "marquee" : "outline"} onClick={toggleLike}>
              <Heart className={liked ? "fill-current" : ""} /> {formatCount(likes ?? movie.likes ?? 0)}
            </Button>
          </div>
        </div>
        {(movie.description || movie.keywords) && (
          <div className="mt-4 rounded-xl bg-card p-4 text-sm">
            <p className="whitespace-pre-wrap">{movie.description}</p>
            {movie.keywords && (
              <div className="mt-3 flex flex-wrap gap-2">
                {movie.keywords.split(",").map((k) => k.trim()).filter(Boolean).map((k) => (
                  <Link key={k} to="/" search={{ q: k }} className="rounded-full bg-secondary px-3 py-1 text-xs hover:text-primary">
                    #{k}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <aside>
        <h2 className="mb-4 text-xl">Up next</h2>
        <div className="grid gap-5">
          {recs.map((m) => <MovieCard key={m.id} movie={m} />)}
          {!recs.length && <p className="text-sm text-muted-foreground">No other movies yet.</p>}
        </div>
      </aside>
    </div>
  );
}
