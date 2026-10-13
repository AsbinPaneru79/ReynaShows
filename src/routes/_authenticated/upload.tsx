import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { runAi } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload a movie — ReynaShows" },
      { name: "description", content: "Share your movie on ReynaShows with a title, description and thumbnail." },
      { property: "og:title", content: "Upload a movie — ReynaShows" },
      { property: "og:description", content: "Share your movie on ReynaShows." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const navigate = useNavigate();
  const ai = useServerFn(runAi);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  async function suggest() {
    if (!title.trim()) { toast.error("Enter a title first"); return; }
    setAiBusy(true);
    try {
      const r = await ai({ data: { mode: "describe", title, notes: description } });
      if (!r.ok) { toast.error(r.error); return; }
      const res = JSON.parse(r.result) as { description?: string; keywords?: string };
      if (res.description) setDescription(res.description);
      if (res.keywords) setKeywords(res.keywords);
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!video || !thumb) { toast.error("Choose a video and a thumbnail"); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const ext = (f: File) => f.name.split(".").pop()?.toLowerCase() || "bin";
      const videoPath = `${uid}/${stamp}.${ext(video)}`;
      const thumbPath = `${uid}/${stamp}.${ext(thumb)}`;
      setStep(1);
      const t = await supabase.storage.from("thumbnails").upload(thumbPath, thumb, { contentType: thumb.type });
      if (t.error) throw t.error;
      setStep(2);
      const v = await supabase.storage.from("videos").upload(videoPath, video, { contentType: video.type });
      if (v.error) throw v.error;
      setStep(3);
      const { data, error } = await supabase
        .from("movies")
        .insert({ user_id: uid, title, description, keywords, video_path: videoPath, thumbnail_path: thumbPath })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Movie published!");
      navigate({ to: "/watch/$id", params: { id: data.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setStep(0);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-4xl font-semibold">Upload a movie</h1>
      <p className="mt-1 text-muted-foreground">Videos up to 1 GB.</p>
      <form onSubmit={submit} className="mt-8 grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="desc">Description</Label>
            <Button type="button" size="sm" variant="ghost" onClick={suggest} disabled={aiBusy}>
              <Wand2 /> {aiBusy ? "Writing…" : "Write with AI"}
            </Button>
          </div>
          <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kw">Keywords</Label>
          <Input id="kw" placeholder="action, heist, thriller" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="video">Video file</Label>
            <Input id="video" type="file" accept="video/*" required onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="thumb">Thumbnail image</Label>
            <Input id="thumb" type="file" accept="image/*" required onChange={(e) => setThumb(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        {busy && (
          <div className="grid gap-2">
            <Progress value={(step / 3) * 100} />
            <p className="text-xs text-muted-foreground">
              {["", "Uploading thumbnail…", "Uploading video…", "Publishing…"][step]}
            </p>
          </div>
        )}
        <Button type="submit" variant="marquee" size="lg" disabled={busy}>
          {busy ? "Uploading…" : "Publish movie"}
        </Button>
      </form>
    </div>
  );
}
