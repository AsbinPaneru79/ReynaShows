import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Film, LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { setPendingVideo } from "@/lib/pending-upload";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          <span className="font-display text-2xl font-semibold tracking-tight">
            Reyna<span className="text-primary">Shows</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setPendingVideo(f);
                  navigate({ to: "/upload" });
                }}
              />
              <Button variant="marquee" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload /> Upload
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Log in</Link></Button>
              <Button asChild variant="marquee" size="sm"><Link to="/signup">Sign up</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
