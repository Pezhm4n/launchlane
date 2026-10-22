"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { parseConnection, type ConnectionView } from "../contracts/connections.ts";
import {
  decodeRepositoryPage,
  gitRevision,
  parseGitHubLogin,
  type GitHubBranch,
  type GitHubLoginView,
  type GitHubRepository,
} from "../contracts/github.ts";
import type { ProjectSelection } from "../contracts/project-flow.ts";
import { integer, object, string } from "../contracts/validation.ts";
import { ensure } from "../server/errors.ts";
import { api, ClientError } from "./api.ts";
import { FolderIcon } from "./FolderPicker.tsx";

const loginPending = (login: GitHubLoginView | null) =>
  Boolean(
    login && ["starting", "awaiting_user", "checking", "confirm_account"].includes(login.state),
  );
export function GitHubProjectPicker({
  csrf,
  initialConnection,
  onSelect,
  onRefresh,
  onClose,
  onSessionExpired,
}: {
  csrf: string;
  initialConnection: ConnectionView | null;
  onSelect: (selection: ProjectSelection, signal?: AbortSignal) => Promise<boolean>;
  onRefresh: () => Promise<unknown>;
  onClose: (selected?: boolean) => void;
  onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    errorBox = useRef<HTMLDivElement>(null),
    disconnectTrigger = useRef<HTMLButtonElement>(null),
    disconnectConfirm = useRef<HTMLButtonElement>(null),
    pending = useRef<AbortController | null>(null);
  const importControl = useRef<HTMLButtonElement>(null),
    cancelledImport = useRef(false);
  const [connection, setConnection] = useState(initialConnection),
    [toolReady, setToolReady] = useState<boolean | null>(null),
    [login, setLogin] = useState<GitHubLoginView | null>(null);
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState(""),
    [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [query, setQuery] = useState(""),
    [appliedQuery, setAppliedQuery] = useState(""),
    [repos, setRepos] = useState<GitHubRepository[]>([]),
    [nextPage, setNextPage] = useState<number | null>(1);
  const [repo, setRepo] = useState<GitHubRepository | null>(null),
    [branches, setBranches] = useState<GitHubBranch[]>([]),
    [branchPage, setBranchPage] = useState<number | null>(null),
    [branch, setBranch] = useState<GitHubBranch | null>(null);
  const [directory, setDirectory] = useState("."),
    [folders, setFolders] = useState<string[]>([]);
  const fail = useCallback(
    (error: unknown) => {
      if (error instanceof ClientError) {
        setError(error);
        if (error.code === "AUTH_REQUIRED") onSessionExpired();
      } else
        setError(
          new ClientError(
            "GITHUB_CONNECTION_FAILED",
            "پاسخ GitHub دریافت نشد. انتخاب قبلی حفظ شده است؛ دوباره تلاش کنید.",
          ),
        );
    },
    [onSessionExpired],
  );
  const post = useCallback(
    <T,>(body: unknown, decode: (value: unknown) => T, signal?: AbortSignal) =>
      api("/api/connections/github", decode, { body, csrf, ...(signal ? { signal } : {}) }),
    [csrf],
  );
  const metadata = useCallback(async () => {
    setError(null);
    try {
      const state = await api("/api/connections/github", (value) => {
        const row = object(value);
        return {
          connection: row.connection === null ? null : parseConnection(row.connection),
          toolReady: row.toolReady === true,
        };
      });
      setToolReady(state.toolReady);
      setConnection(state.connection);
    } catch (error) {
      fail(error);
    }
  }, [fail]);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    void metadata();
    return () => {
      pending.current?.abort();
      node?.close();
    };
  }, [metadata]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (confirmDisconnect) disconnectConfirm.current?.focus();
  }, [confirmDisconnect]);
  useEffect(() => {
    if (repo) heading.current?.focus();
  }, [repo]);
  useEffect(() => {
    if (!busy && cancelledImport.current) {
      cancelledImport.current = false;
      importControl.current?.focus();
    }
  }, [busy]);
  useEffect(() => {
    if (!login || !["starting", "awaiting_user", "checking"].includes(login.state)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      post(
        { operation: "status", id: login.id },
        (value) => parseGitHubLogin(object(value).login),
        controller.signal,
      )
        .then((next) => {
          if (!controller.signal.aborted) setLogin(next);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) fail(error);
        });
    }, 1500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [login, post, fail]);
  async function job(label: string, task: (signal: AbortSignal) => Promise<void>) {
    if (busy || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(label);
    setError(null);
    setNotice("");
    try {
      await task(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) fail(error);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  const loadRepos = useCallback(
    async (search: string, page: number, signal: AbortSignal) => {
      const result = await post(
        { operation: "repositories", query: search, page },
        decodeRepositoryPage,
        signal,
      );
      if (signal.aborted) return;
      setRepos((current) =>
        page === 1
          ? result.repositories
          : [
              ...current,
              ...result.repositories.filter((row) => !current.some((old) => old.id === row.id)),
            ],
      );
      setAppliedQuery(search);
      setNextPage(result.nextPage);
      setRepo(null);
      setBranch(null);
      setNotice(
        result.repositories.length === 0 && result.nextPage !== null
          ? "در این بخش از فهرست موردی پیدا نشد؛ برای ادامه جست‌وجو مخزن‌های بیشتر را بخوانید."
          : "",
      );
    },
    [post],
  );
  useEffect(() => {
    if (connection?.status !== "connected") return;
    if (!connection.identityId) return;
    const controller = new AbortController();
    setBusy("repositories");
    loadRepos("", 1, controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) fail(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(null);
      });
    return () => controller.abort();
    // Account identity changes require a fresh catalog; search/pagination are explicit actions.
  }, [connection?.identityId, connection?.status, loadRepos, fail]);
  async function connect() {
    await job("login", async (signal) => {
      const next = await post(
        { operation: "start" },
        (value) => parseGitHubLogin(object(value).login),
        signal,
      );
      if (!signal.aborted) setLogin(next);
    });
  }
  async function cancelLogin() {
    if (!login) return;
    await job("cancel", async (signal) => {
      const next = await post(
        { operation: "cancel", id: login.id },
        (value) => parseGitHubLogin(object(value).login),
        signal,
      );
      if (!signal.aborted) setLogin(next);
    });
  }
  async function confirm() {
    if (!login) return;
    await job("confirm", async (signal) => {
      const next = await post(
        { operation: "confirm", id: login.id },
        (value) => parseConnection(object(value).connection),
        signal,
      );
      if (signal.aborted) return;
      setLogin(null);
      setConnection(next);
      await onRefresh();
    });
  }
  async function disconnect() {
    await job("disconnect", async (signal) => {
      await api("/api/connections/github", () => true, { method: "DELETE", csrf, signal });
      if (signal.aborted) return;
      setConnection(null);
      setRepo(null);
      setRepos([]);
      setLogin(null);
      setNotice("اتصال Launchlane قطع شد. دسترسی ابزار رسمی در GitHub ابطال نشده است.");
      await onRefresh();
    });
  }
  const repositoryArgs = (repository: GitHubRepository) => ({
    owner: repository.owner,
    name: repository.name,
    repositoryId: repository.id,
  });
  async function listBranches(repository: GitHubRepository, page = 1) {
    await job("branches", async (signal) => {
      const result = await post(
        { operation: "branches", ...repositoryArgs(repository), page },
        (value) => {
          const row = object(value);
          ensure(
            Array.isArray(row.branches) && row.branches.length <= 30,
            "INVALID_RESPONSE",
            "فهرست شاخه‌ها معتبر نیست.",
          );
          return {
            branches: row.branches.map((value: unknown) => {
              const item = object(value);
              return { name: string(item.name, 256), commit: gitRevision(item.commit) };
            }),
            nextPage: row.nextPage === null ? null : integer(row.nextPage, 1, 1000),
          };
        },
        signal,
      );
      if (signal.aborted) return;
      setRepo(repository);
      setBranches((current) => (page === 1 ? result.branches : [...current, ...result.branches]));
      setBranchPage(result.nextPage);
      if (page === 1) {
        setBranch(null);
        setDirectory(".");
        setFolders([]);
      }
    });
  }
  async function chooseBranch(selected: GitHubBranch, path = ".") {
    if (!repo) return;
    await job("folders", async (signal) => {
      const result = await post(
        {
          operation: "folders",
          ...repositoryArgs(repo),
          revision: selected.commit,
          directory: path,
        },
        (value) => {
          const rows = object(value).folders;
          ensure(
            Array.isArray(rows) && rows.length <= 1000,
            "INVALID_RESPONSE",
            "فهرست پوشه‌ها معتبر نیست.",
          );
          return rows.map((row: unknown) => string(row, 160));
        },
        signal,
      );
      if (!signal.aborted) {
        setBranch(selected);
        setDirectory(path);
        setFolders(result);
      }
    });
  }
  async function importProject() {
    if (!repo || !branch) return;
    await job("import", async (signal) => {
      const accepted = await onSelect(
        {
          kind: "github",
          ...repositoryArgs(repo),
          branch: branch.name,
          revision: branch.commit,
          directory,
        },
        signal,
      );
      if (accepted) onClose(true);
      else if (signal.aborted) {
        cancelledImport.current = true;
        setNotice("دریافت پروژه متوقف شد. پروژه قبلی حفظ شده است.");
      }
    });
  }
  function close() {
    if (busy === "import") return;
    if (loginPending(login) && login)
      void post({ operation: "cancel", id: login.id }, () => true).catch(() => undefined);
    onClose();
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void job("repositories", (signal) => loadRepos(query, 1, signal));
  }
  return (
    <dialog
      ref={dialog}
      className="folder-dialog github-dialog"
      aria-labelledby="github-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="section-heading">
        <h2 id="github-picker-title">انتخاب پروژه از GitHub</h2>
        <button type="button" className="button-quiet" disabled={busy === "import"} onClick={close}>
          انصراف
        </button>
      </div>
      <div aria-busy={busy !== null}>
        {connection?.status !== "connected" ? (
          <>
            <p>
              در صفحه رسمی GitHub وارد شوید و دسترسی را بررسی کنید. فقط مخزن‌هایی که اجازه خواندنشان
              را دارید در فهرست نمایش داده می‌شوند؛ مجوز سازمان ممکن است جداگانه لازم باشد.
            </p>
            <p className="hint">
              ورود از ابزار رسمی GitHub انجام می‌شود. خود این ابزار مجوزهای repo، read:org و gist
              درخواست می‌کند؛ Launchlane فقط فایل‌های مخزن انتخابی را می‌خواند. اگر این محدوده مناسب
              نیست، پوشه محلی را انتخاب کنید.
            </p>
            {login?.state === "awaiting_user" ? (
              <div className="login-challenge">
                <p>این کد را فقط در صفحه رسمی GitHub وارد کنید:</p>
                <code className="device-code" dir="ltr">
                  {login.userCode}
                </code>
                <a
                  className="button-link"
                  href={login.verificationUrl || undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  باز کردن صفحه ورود GitHub
                </a>
                <p className="hint">
                  پس از تأیید در GitHub، به همین پنجره برگردید. کلید دسترسی را اینجا وارد نمی‌کنید.
                </p>
              </div>
            ) : login?.state === "confirm_account" ? (
              <div className="archive-result">
                <p>
                  حساب تأییدشده:{" "}
                  <strong>
                    <bdi>{login.account?.login}</bdi>
                  </strong>
                </p>
                <button type="button" disabled={busy !== null} onClick={() => void confirm()}>
                  اتصال همین حساب
                </button>
              </div>
            ) : login?.state === "starting" || login?.state === "checking" ? (
              <p role="status">
                {login.state === "starting"
                  ? "در حال دریافت کد ورود از GitHub…"
                  : "در حال بررسی هویت حساب…"}
              </p>
            ) : (
              <>
                {login?.state === "failed" ? (
                  <p className="note">{login.error?.message}</p>
                ) : login?.state === "expired" ? (
                  <p className="note">مهلت ورود تمام شد. دوباره اتصال را شروع کنید.</p>
                ) : login?.state === "cancelled" ? (
                  <p className="hint">ورود لغو شد. انتخاب پروژه قبلی حفظ شده است.</p>
                ) : null}
                <button
                  type="button"
                  disabled={busy !== null || toolReady !== true}
                  onClick={() => void connect()}
                >
                  اتصال به GitHub
                </button>
              </>
            )}
            {loginPending(login) ? (
              <button
                type="button"
                className="button-secondary"
                disabled={busy !== null}
                onClick={() => void cancelLogin()}
              >
                لغو ورود GitHub
              </button>
            ) : null}
            {toolReady === null ? (
              <p role="status">در حال بررسی ابزار ورود…</p>
            ) : !toolReady ? (
              <div className="note">
                <p>
                  ابزار رسمی ورود روی این نصب آماده نیست. پروژه محلی را می‌توانید انتخاب کنید. برای
                  فعال‌کردن GitHub، مسئول نصب این فرمان را اجرا کند:
                </p>
                <code>npm run setup:github</code>
                <button type="button" className="button-secondary" onClick={() => void metadata()}>
                  بررسی دوباره ابزار ورود
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="section-heading">
              <p>
                متصل به{" "}
                <strong>
                  <bdi>{connection.login}</bdi>
                </strong>
              </p>
              {!confirmDisconnect ? (
                <button
                  type="button"
                  className="button-danger"
                  ref={disconnectTrigger}
                  disabled={busy !== null}
                  onClick={() => setConfirmDisconnect(true)}
                >
                  قطع اتصال GitHub
                </button>
              ) : null}
            </div>
            {confirmDisconnect ? (
              <fieldset
                className="note note-danger"
                aria-labelledby="github-disconnect-title"
              >
                <legend id="github-disconnect-title">ورود GitHub از این میز کار قطع شود؟</legend>
                <p>
                  دسترسی Launchlane به مخزن‌ها از این میز کار پاک می‌شود. فایل‌ها و مخزن‌های شما در
                  GitHub تغییری نمی‌کنند و دسترسی ابزار رسمی نیز خودکار ابطال نمی‌شود.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button-danger"
                    ref={disconnectConfirm}
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmDisconnect(false);
                      void disconnect();
                    }}
                  >
                    بله، اتصال را قطع کن
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmDisconnect(false);
                      requestAnimationFrame(() => disconnectTrigger.current?.focus());
                    }}
                  >
                    انصراف
                  </button>
                </div>
              </fieldset>
            ) : null}
            {!repo ? (
              <>
                <form onSubmit={search}>
                  <label htmlFor="repository-search">جست‌وجوی مخزن‌های در دسترس</label>
                  <div className="search-row">
                    <input
                      id="repository-search"
                      value={query}
                      dir="auto"
                      maxLength={100}
                      disabled={busy !== null}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <button type="submit" disabled={busy !== null}>
                      جست‌وجو
                    </button>
                  </div>
                </form>
                <p className="hint">
                  {appliedQuery ? (
                    <>
                      نتایج برای <bdi>{appliedQuery}</bdi>
                    </>
                  ) : (
                    "مخزن عمومی یا خصوصی را انتخاب کنید. اتصال حساب، دسترسی همه مخزن‌ها یا سازمان‌ها را تضمین نمی‌کند."
                  )}
                </p>
                <ul className="folder-list">
                  {repos.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="button-secondary repository-option"
                        disabled={busy !== null}
                        onClick={() => void listBranches(item)}
                      >
                        <bdi>
                          {item.owner}/{item.name}
                        </bdi>
                        <span className="hint">{item.private ? "خصوصی" : "عمومی"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!repos.length && !busy ? (
                  <p>
                    مخزنی در این بخش از فهرست پیدا نشد. مجوز حساب یا سازمان را در GitHub بررسی کنید.
                  </p>
                ) : null}
                {nextPage !== null ? (
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy !== null}
                    onClick={() =>
                      void job("repositories", (signal) =>
                        loadRepos(appliedQuery, nextPage, signal),
                      )
                    }
                  >
                    مخزن‌های بیشتر
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <div className="section-heading">
                  <h3 ref={heading} tabIndex={-1}>
                    <bdi>
                      {repo.owner}/{repo.name}
                    </bdi>
                  </h3>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      setRepo(null);
                      setBranch(null);
                    }}
                  >
                    تغییر مخزن
                  </button>
                </div>
                <fieldset disabled={busy !== null}>
                  <legend>شاخه پروژه</legend>
                  <div className="app-options">
                    {branches.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className="button-secondary"
                        aria-pressed={branch?.name === item.name}
                        onClick={() => void chooseBranch(item)}
                      >
                        <bdi>{item.name}</bdi>
                        {item.name === repo.defaultBranch ? " · پیش‌فرض مخزن" : ""}
                      </button>
                    ))}
                  </div>
                  {!branches.length ? (
                    <p className="note">
                      این مخزن هنوز شاخه قابل دریافت ندارد. ابتدا کد پروژه را در GitHub قرار دهید.
                    </p>
                  ) : null}
                  {branchPage !== null ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => void listBranches(repo, branchPage)}
                    >
                      شاخه‌های بیشتر
                    </button>
                  ) : null}
                </fieldset>
                {branch ? (
                  <>
                    <h3>پوشه پروژه در مخزن</h3>
                    <p className="hint">
                      {directory === "." ? (
                        "ریشه مخزن انتخاب شده است. اگر چند پروژه دارید، پوشه دارای package.json را باز کنید."
                      ) : (
                        <bdi>{directory}</bdi>
                      )}
                    </p>
                    {directory !== "." ? (
                      <button
                        className="button-secondary"
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          void chooseBranch(
                            branch,
                            directory.includes("/")
                              ? directory.slice(0, directory.lastIndexOf("/"))
                              : ".",
                          )
                        }
                      >
                        پوشه بالاتر
                      </button>
                    ) : null}
                    <ul className="folder-list">
                      {folders.map((folder) => (
                        <li key={folder}>
                          <button
                            type="button"
                            className="button-secondary"
                            disabled={busy !== null}
                            onClick={() =>
                              void chooseBranch(
                                branch,
                                directory === "." ? folder : `${directory}/${folder}`,
                              )
                            }
                          >
                            <FolderIcon />
                            <bdi>{folder}</bdi>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="hint">
                      نسخه انتخاب‌شده: <code>{branch.commit.slice(0, 12)}</code>. فقط همین نسخه
                      دریافت می‌شود؛ هیچ کدی اجرا و هیچ فایلی به لیارا ارسال نمی‌شود.
                    </p>
                    <button
                      type="button"
                      ref={importControl}
                      disabled={busy !== null}
                      onClick={() => void importProject()}
                    >
                      {busy === "import"
                        ? "در حال دریافت و بررسی پروژه…"
                        : "انتخاب این پوشه و بررسی پروژه"}
                    </button>
                  </>
                ) : (
                  <p className="hint">شاخه‌ای را انتخاب کنید تا پوشه‌های همان نسخه خوانده شوند.</p>
                )}
              </>
            )}
          </>
        )}
        {busy && busy !== "login" && busy !== "confirm" ? (
          <p role="status">
            {busy === "import"
              ? "دریافت و آماده‌سازی محلی پروژه در حال انجام است…"
              : "در حال خواندن اطلاعات GitHub…"}
          </p>
        ) : null}
        {busy === "import" ? (
          <button
            type="button"
            className="button-secondary"
            onClick={() => pending.current?.abort()}
          >
            لغو دریافت پروژه
          </button>
        ) : null}
        <div role="status" aria-live="polite" className="hint">
          {notice}
        </div>
        {error ? (
          <div
            className="error-banner"
            role="alert"
            aria-label="GitHub کامل نشد"
            tabIndex={-1}
            ref={errorBox}
          >
            <p>{error.message}</p>
            {error.requestId ? (
              <details>
                <summary>شناسه پیگیری</summary>
                <code>{error.requestId}</code>
              </details>
            ) : null}
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() => {
                setError(null);
                void metadata();
              }}
            >
              بررسی دوباره اتصال
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
