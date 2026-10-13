import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Wand2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MovieCard } from "@/components/MovieCard";
import { useAuth } from "@/hooks/use-auth";
import { runAi } from "@/lib/ai.functions";
import { searchAnyTerm, searchMovies } from "@/lib/movies";


export const Route = createFileRoute("/")({
  validateSearch: z.object({ q: z.string().optional() }),
  ssr: false,
  head: () => ({
    meta: [
      { title: "ReynaShows — Watch and share movies" },
      { name: "description", content: "Discover, watch and upload movies on ReynaShows, with smart keyword search." },
      { property: "og:title", content: "ReynaShows — Watch and share movies" },
      { property: "og:description", content: "Discover, watch and upload movies on ReynaShows." },
    ],
  }),
  component: Home,
});

/** Parse a Google-like query: quoted phrases stay together, the rest splits on spaces. */
function parseQuery(q: string) {
  const terms: string[] = [];
  q.replace(/"([^"]+)"|(\S+)/g, (_m, phrase, word) => {
    terms.push(phrase ?? word);
    return "";
  });
  return terms;
}

function Home() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { user } = useAuth();
  const ai = useServerFn(runAi);
  const [input, setInput] = useState(q);
  const [smart, setSmart] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => setInput(q), [q]);

  const { data: movies = [], isLoading } = useQuery({
    queryKey: ["movies", q, smart && !!user],
    queryFn: async () => {
      setAiNote(null);
      const terms = parseQuery(q);
      const exact = await searchMovies(terms);
      if (!q || !smart || !user) return exact;
      const r = await ai({ data: { mode: "search", query: q } });
      if (!r.ok) {
        setAiNote(r.error);
        return exact;
      }
      const extra = ((JSON.parse(r.result) as { terms?: string[] }).terms ?? []).slice(0, 8);
      setAiNote(extra.length ? `Also searched: ${extra.join(", ")}` : null);
      const wide = await searchAnyTerm([...terms, ...extra]);
      const seen = new Set(exact.map((m) => m.id));
      return [...exact, ...wide.filter((m) => !seen.has(m.id))];
    },
    staleTime: 30_000,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20">
      <section className="py-12 text-center">
        <h1 className="text-5xl font-semibold md:text-6xl">
          Tonight's <em className="text-primary">showing</em>
        </h1>
        <p className="mt-3 text-muted-foreground">Movies shared by the ReynaShows community.</p>
        <form
          className="mx-auto mt-8 flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { q: input.trim() || undefined } });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='Search titles, keywords… try "space adventure"'
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" variant="marquee" className="h-11">Search</Button>
        </form>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Switch id="smart" checked={smart} onCheckedChange={setSmart} disabled={!user} />
          <label htmlFor="smart" className="flex items-center gap-1">
            <Wand2 className="h-4 w-4" /> Smart AI search
            {!user && <> — <Link to="/login" className="text-primary">log in</Link> to use</>}
          </label>
        </div>
        {aiNote && <p className="mt-2 text-xs text-muted-foreground">{aiNote}</p>}
      </section>

      {q && <h2 className="mb-6 text-2xl">Results for “{q}”</h2>}
      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : movies.length ? (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {movies.map((m) => <MovieCard key={m.id} movie={m} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="text-lg">{q ? "No movies match that search." : "No movies yet."}</p>
          <Button asChild variant="marquee" className="mt-4">
            <Link to={user ? "/upload" : "/signup"}>Upload the first one</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
