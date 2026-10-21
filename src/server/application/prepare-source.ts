import type { SourceArtifact } from "../../contracts/domain.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { createSourceArchive, persistArtifact } from "../workspace/archive.ts";

// One bounded capture at a time in the operator process; concurrent requests cannot multiply the 20 MiB snapshot.
let preparing = false;

export async function prepareArchive(input: {
  store: Store;
  stateDir: string;
  workspaceRoot: string;
  actorId: string;
  directory: string;
  sourceHash: string;
  secrets?: readonly string[];
  signal?: AbortSignal;
}): Promise<SourceArtifact> {
  ensure(!preparing, "SOURCE_BUSY", "یک بسته در حال آماده‌سازی است؛ کمی بعد دوباره تلاش کنید.", 429);
  preparing = true;
  try {
    const { artifact, bytes } = await createSourceArchive(input);
    await persistArtifact(input.stateDir, artifact, bytes);
    ensure(!input.signal?.aborted, "CANCELLED", "آماده‌سازی متوقف شد؛ هیچ فایلی ارسال نشد.", 409);
    // Bytes are flushed before the durable receipt: an orphaned blob cannot authorize a proposal.
    return input.store.recordArtifact(input.actorId, artifact);
  } finally {
    preparing = false;
  }
}
