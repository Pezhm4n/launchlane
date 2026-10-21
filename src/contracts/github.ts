import { ensure } from "../server/errors.ts";
import { integer, object, string } from "./validation.ts";
export type GitHubRepository = {
  id: number;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
};
export type RepositoryPage = {
  repositories: GitHubRepository[];
  nextPage: number | null;
  scannedPages: number;
};
export type GitHubBranch = { name: string; commit: string };
export function githubOwner(value: unknown): string {
  const result = string(value, 39);
  ensure(
    /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(result),
    "GITHUB_INPUT_INVALID",
    "نام حساب مخزن معتبر نیست.",
  );
  return result;
}
export function githubRepoName(value: unknown): string {
  const result = string(value, 100);
  ensure(
    /^[A-Za-z0-9_.-]+$/.test(result) && result !== "." && result !== "..",
    "GITHUB_INPUT_INVALID",
    "نام مخزن معتبر نیست.",
  );
  return result;
}
export function gitRevision(value: unknown): string {
  const result = string(value, 40);
  ensure(/^[a-f0-9]{40}$/.test(result), "GITHUB_INPUT_INVALID", "نسخه مخزن معتبر نیست.");
  return result;
}
export function parseRepository(value: unknown): GitHubRepository {
  const raw = object(value),
    owner = object(raw.owner);
  ensure(
    typeof raw.private === "boolean",
    "GITHUB_RESPONSE_INVALID",
    "نوع دسترسی مخزن مشخص نیست.",
    502,
  );
  const name = githubRepoName(raw.name),
    ownerName = githubOwner(owner.login);
  ensure(
    raw.full_name === `${ownerName}/${name}`,
    "GITHUB_RESPONSE_INVALID",
    "هویت مخزن با پاسخ تطبیق ندارد.",
    502,
  );
  return {
    id: integer(raw.id, 1, Number.MAX_SAFE_INTEGER),
    owner: ownerName,
    name,
    private: raw.private,
    defaultBranch: string(raw.default_branch, 256),
  };
}
export function decodeRepositoryPage(value: unknown): RepositoryPage {
  const raw = object(value);
  ensure(
    Array.isArray(raw.repositories) && raw.repositories.length <= 30,
    "GITHUB_RESPONSE_INVALID",
    "فهرست مخزن‌ها معتبر نیست.",
  );
  return {
    repositories: raw.repositories.map((value: unknown) => {
      const row = object(value);
      ensure(typeof row.private === "boolean", "GITHUB_RESPONSE_INVALID", "نوع مخزن معتبر نیست.");
      return {
        id: integer(row.id, 1, Number.MAX_SAFE_INTEGER),
        owner: githubOwner(row.owner),
        name: githubRepoName(row.name),
        private: row.private,
        defaultBranch: string(row.defaultBranch, 256),
      };
    }),
    nextPage: raw.nextPage === null ? null : integer(raw.nextPage, 1, 1000),
    scannedPages: integer(raw.scannedPages, 1, 5),
  };
}
