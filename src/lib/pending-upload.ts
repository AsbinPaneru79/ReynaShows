// Holds a video picked/dropped elsewhere (e.g. header button) until the upload page reads it.
let pending: File | null = null;
export function setPendingVideo(f: File | null) { pending = f; }
export function takePendingVideo(): File | null { const f = pending; pending = null; return f; }
