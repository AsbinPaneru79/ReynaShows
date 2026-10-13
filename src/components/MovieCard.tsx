import { Link } from "@tanstack/react-router";
import { Eye, Heart } from "lucide-react";
import { formatCount, type Movie } from "@/lib/movies";

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link to="/watch/$id" params={{ id: movie.id }} className="group block">
      <div className="aspect-video overflow-hidden rounded-lg bg-muted">
        {movie.thumbnailUrl && (
          <img
            src={movie.thumbnailUrl}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-medium leading-snug group-hover:text-primary">
        {movie.title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{movie.profiles?.display_name ?? "Unknown"}</p>
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatCount(movie.views)}</span>
        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatCount(movie.likes)}</span>
      </div>
    </Link>
  );
}
