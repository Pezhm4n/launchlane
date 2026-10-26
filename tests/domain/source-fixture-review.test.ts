import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { publicTestFixturePath } from "../../src/contracts/source-fixture-review.ts";
import { readFixtureReviewRegistry, signFixtureReview, sourceReviewFilename } from "../../src/server/policy/source-fixture-review.ts";
import { containsSourceCredential } from "../../src/server/policy/redaction.ts";

test("operator public-fixture review binds exact test bytes, expiry and installation signature without weakening known-secret guards", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-source-review-")), state = join(root, "state"), project = join(root, "project"), secret = "source-review-test-installation-secret-".repeat(2),
    source = "const token='do-not-publish';", path = "unit/auth.test.ts";
  const priorState = process.env.LAUNCHLANE_STATE_DIR, priorSecret = process.env.LAUNCHLANE_SESSION_SECRET;
  try {
    await mkdir(state); await mkdir(join(project, "unit"), { recursive: true });
    await writeFile(join(project, "package.json"), '{"scripts":{"start":"node app.mjs"}}'); await writeFile(join(project, "app.mjs"), "// immutable application"); await writeFile(join(project, path), source);
    process.env.LAUNCHLANE_STATE_DIR = state; process.env.LAUNCHLANE_SESSION_SECRET = secret;
    assert.equal(containsSourceCredential(source, [], path), true, "the general source rule remains strict");
    await assert.rejects(captureProject(project, "."), { code: "SENSITIVE_SOURCE" });
    const now = Date.now(), review = signFixtureReview(secret, { version: 1, id: randomUUID(), reviewedAt: now - 100, expiresAt: now + 60000,
      files: [{ path, sha256: createHash("sha256").update(source).digest("hex") }] });
    const save = async (value: unknown) => writeFile(join(state, sourceReviewFilename), JSON.stringify({ version: 1, reviews: [value] }));
    await save(review);
    delete process.env.LAUNCHLANE_SESSION_SECRET;
    await assert.rejects(captureProject(project, "."), { code: "SENSITIVE_SOURCE" });
    process.env.LAUNCHLANE_SESSION_SECRET = secret;
    const accepted = await captureProject(project, "."); assert.equal(accepted.profile.sourceFixtureReviews?.[0]?.id, review.id);
    assert.ok(accepted.files.some(file => file.path === path && file.content.toString() === source), "review does not edit or drop test bytes");
    await assert.rejects(captureProject(project, ".", { secrets: ["do-not-publish"] }), { code: "SENSITIVE_SOURCE" });
    await writeFile(join(project, path), "const token='different-unreviewed-input';"); await assert.rejects(captureProject(project, "."), { code: "SENSITIVE_SOURCE" });
    await writeFile(join(project, path), source);
    await save(signFixtureReview(secret, { ...review, reviewedAt: now - 10000, expiresAt: now - 1000 }));
    await assert.rejects(captureProject(project, "."), { code: "SENSITIVE_SOURCE" });
    await save({ ...review, files: [{ path, sha256: "f".repeat(64) }] }); assert.throws(() => readFixtureReviewRegistry(state, secret), { code: "SOURCE_REVIEW_INVALID" });
    for (const value of ["server/auth.ts", "../unit/auth.test.ts", "C:/unit/auth.test.ts", "unit/../../auth.test.ts"]) assert.throws(() => publicTestFixturePath(value));
  } finally {
    if (priorState === undefined) delete process.env.LAUNCHLANE_STATE_DIR; else process.env.LAUNCHLANE_STATE_DIR = priorState;
    if (priorSecret === undefined) delete process.env.LAUNCHLANE_SESSION_SECRET; else process.env.LAUNCHLANE_SESSION_SECRET = priorSecret;
    await rm(root, { recursive: true, force: true });
  }
});
