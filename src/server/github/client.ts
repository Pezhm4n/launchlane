import {
  githubOwner,
  githubRepoName,
  gitRevision,
  parseRepository,
  type GitHubBranch,
  type GitHubRepository,
  type RepositoryPage,
} from "../../contracts/github.ts";
import { integer, object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import type { GitHubTransport } from "./cli.ts";
import { checkName, excludedPath } from "../workspace/paths.ts";
import { projectSubdirectory } from "./import.ts";

function json(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new AppError("GITHUB_RESPONSE_INVALID", "پاسخ GitHub خوانا نیست. دوباره تلاش کنید.", 502);
  }
}
export type GitHubIdentity = { id: string; login: string; name: string };
export class GitHubClient {
  readonly transport: GitHubTransport;
  constructor(transport: GitHubTransport) {
    this.transport = transport;
  }
  async identity(signal: AbortSignal): Promise<GitHubIdentity> {
    const raw = object(json((await this.transport("/user", signal)).body));
    const login = githubOwner(raw.login);
    return {
      id: String(integer(raw.id, 1, Number.MAX_SAFE_INTEGER)),
      login,
      name: typeof raw.name === "string" && raw.name.trim() ? string(raw.name, 160) : login,
    };
  }
  async repositories(query: string, page: number, signal: AbortSignal): Promise<RepositoryPage> {
    ensure(
      query.length <= 100 && !/[\r\n]/.test(query),
      "GITHUB_INPUT_INVALID",
      "جست‌وجو را کوتاه‌تر بنویسید.",
    );
    integer(page, 1, 1000);
    const repositories: GitHubRepository[] = [];
    let scannedPages = 0,
      nextPage: number | null = page;
    while (nextPage !== null && scannedPages < 5 && repositories.length === 0) {
      const current: number = nextPage;
      const response = await this.transport(
        `/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=30&page=${current}`,
        signal,
      );
      const rows = json(response.body);
      ensure(
        Array.isArray(rows) && rows.length <= 30,
        "GITHUB_RESPONSE_INVALID",
        "فهرست مخزن‌ها کامل نیست.",
        502,
      );
      for (const raw of rows) {
        const repo = parseRepository(raw);
        if (`${repo.owner}/${repo.name}`.toLowerCase().includes(query.toLowerCase().trim()))
          repositories.push(repo);
      }
      scannedPages++;
      nextPage = response.hasNext && current < 1000 ? current + 1 : null;
    }
    return { repositories, nextPage, scannedPages };
  }
  async repository(
    owner: string,
    name: string,
    expectedId: number,
    signal: AbortSignal,
  ): Promise<GitHubRepository> {
    const repository = parseRepository(
      json(
        (await this.transport(`/repos/${githubOwner(owner)}/${githubRepoName(name)}`, signal)).body,
      ),
    );
    ensure(
      repository.id === expectedId &&
        repository.owner.toLowerCase() === owner.toLowerCase() &&
        repository.name.toLowerCase() === name.toLowerCase(),
      "GITHUB_REPOSITORY_CHANGED",
      "هویت مخزن تغییر کرده است. آن را دوباره از فهرست انتخاب کنید.",
      409,
    );
    return repository;
  }
  async branches(
    repository: GitHubRepository,
    page: number,
    signal: AbortSignal,
  ): Promise<{ branches: GitHubBranch[]; nextPage: number | null }> {
    integer(page, 1, 1000);
    const response = await this.transport(
      `/repos/${repository.owner}/${repository.name}/branches?per_page=30&page=${page}`,
      signal,
    );
    const rows = json(response.body);
    ensure(
      Array.isArray(rows) && rows.length <= 30,
      "GITHUB_RESPONSE_INVALID",
      "فهرست شاخه‌ها معتبر نیست.",
      502,
    );
    return {
      branches: rows.map((value: unknown) => {
        const row = object(value);
        return { name: string(row.name, 256), commit: gitRevision(object(row.commit).sha) };
      }),
      nextPage: response.hasNext && page < 1000 ? page + 1 : null,
    };
  }
  async revision(
    repository: GitHubRepository,
    branch: string,
    signal: AbortSignal,
  ): Promise<string> {
    const path = `/repos/${repository.owner}/${repository.name}/branches/${encodeURIComponent(string(branch, 256))}`;
    const raw = object(json((await this.transport(path, signal)).body));
    ensure(
      raw.name === branch,
      "GITHUB_BRANCH_CHANGED",
      "شاخه تغییر کرده است. فهرست شاخه‌ها را تازه کنید.",
      409,
    );
    return gitRevision(object(raw.commit).sha);
  }
  async folders(
    repository: GitHubRepository,
    revision: string,
    directory: string,
    signal: AbortSignal,
  ): Promise<string[]> {
    projectSubdirectory(directory);
    const path = directory === "." ? "" : directory.split("/").map(encodeURIComponent).join("/");
    const response = await this.transport(
      `/repos/${repository.owner}/${repository.name}/contents/${path}?ref=${gitRevision(revision)}`,
      signal,
    );
    const rows = json(response.body);
    ensure(
      Array.isArray(rows) && rows.length <= 1000,
      "GITHUB_RESPONSE_INVALID",
      "این پوشه برای مرور مستقیم بیش از حد بزرگ است. زیرپوشه را در بخش تنظیمات انتخاب کنید.",
      413,
    );
    const folders: string[] = [];
    for (const value of rows) {
      const row = object(value);
      if (row.type === "dir") {
        const name = string(row.name, 160);
        if (excludedPath(name)) continue;
        checkName(name);
        folders.push(name);
      }
    }
    return folders;
  }
  async archive(
    repository: GitHubRepository,
    revision: string,
    signal: AbortSignal,
  ): Promise<Buffer> {
    return (
      await this.transport(
        `/repos/${repository.owner}/${repository.name}/tarball/${gitRevision(revision)}`,
        signal,
        25_165_824,
      )
    ).body;
  }
}

export function secureGitHubStatus(value: unknown): string {
  const hosts = object(object(value).hosts),
    entries = hosts["github.com"];
  ensure(Array.isArray(entries), "GITHUB_AUTH_REQUIRED", "ابتدا حساب GitHub را متصل کنید.", 403);
  const active = entries
    .map(object)
    .filter((row) => row.active === true && row.host === "github.com");
  const account = active.length === 1 ? active[0] : null;
  ensure(
    account && account.state === "success",
    "GITHUB_AUTH_REQUIRED",
    "ورود GitHub معتبر نیست. دوباره متصل شوید.",
    403,
  );
  ensure(
    account.tokenSource === "keyring",
    "GITHUB_STORAGE_UNSAFE",
    "نگهداری امن ورود GitHub روی این نصب آماده نیست. مخزن رمز سیستم را فعال و اتصال را دوباره انجام دهید.",
    503,
  );
  return githubOwner(account.login);
}
