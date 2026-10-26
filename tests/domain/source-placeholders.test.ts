import assert from "node:assert/strict";
import { test } from "node:test";
import { containsSourceCredential, redact } from "../../src/server/policy/redaction.ts";

test("request parameter names are metadata while literal defaults and exact installed values remain blocked", () => {
  for (const source of ["const token=c.req.param('token');", "const accessToken=url.searchParams.get('access_token');", "const password=req.query('password');"])
    assert.equal(containsSourceCredential(source, [], "worker/index.ts"), false);
  for (const source of ["const token=c.req.param('token') || 'do-not-publish';", "const token=c.req.param('do-not-publish');", "const token=store.param('token');"])
    assert.equal(containsSourceCredential(source, [], "worker/index.ts"), true);
  assert.equal(containsSourceCredential("const token=c.req.param('token');", ["token"], "worker/index.ts"), true);
});

test("npm token package names are public dependency metadata only when their values are real semver ranges", () => {
  const manifest = { dependencies: { jsonwebtoken: "^9.0.3", gtoken: "^8.0.0", "csrf-token": "1.2.3" } };
  assert.equal(containsSourceCredential(JSON.stringify(manifest), [], "package.json"), false);
  assert.equal(containsSourceCredential(JSON.stringify({ lockfileVersion: 3, packages: { "": manifest, "node_modules/client": manifest } }), [], "guides/package-lock.json"), false);
  for (const value of [{ token: "1.2.3" }, { configuration: manifest }, { dependencies: { gtoken: "actual-private-value" } }, { dependencies: { gtoken: "https://user:pass@example.test/dependency.tgz" } }])
    assert.equal(containsSourceCredential(JSON.stringify(value), [], "package.json"), true);
  assert.equal(containsSourceCredential(JSON.stringify(manifest), ["^9.0.3"], "package.json"), true);
  assert.equal(containsSourceCredential(JSON.stringify(manifest), [], "config.json"), true);
});

test("documented YOUR credential templates do not prevent source selection", () => {
  for (const value of ["YOUR_API_KEY", "YOUR_VALID_KEY", "YOUR_ACCESS_TOKEN", "YOUR_PASSWORD", "YOUR_SESSION_SECRET"]) {
    for (const quote of ["", '"', "'"]) {
      assert.equal(containsSourceCredential(`BOXAPI_API_KEY=${quote}${value}${quote}`), false);
    }
  }
});

test("a documentation omission marker is accepted without exempting runtime files or real values", () => {
  assert.equal(containsSourceCredential("docker run -e JWT_SECRET=... image", [], "README_FA.md"), false);
  assert.equal(containsSourceCredential("JWT_SECRET=...", [], "config.txt"), true);
  assert.equal(containsSourceCredential("JWT_SECRET=...", ["..."], "README.md"), true);
  assert.equal(containsSourceCredential("JWT_SECRET=real-value", [], "README.md"), true);
  assert.equal(redact("JWT_SECRET=..."), "JWT_SECRET=[REDACTED]");
});

test("empty values and complete empty fallbacks are not credentials; concatenated and nonempty defaults remain blocked", () => {
  for (const source of ["const apiKey=process.env.API_KEY || '';", "const token=config.token ?? \"\";", "const token=config.token || ('');", "const form={password:''};", "const settings={apiKey:process.env.API_KEY || null};", "interface Config {apiKey: string | null;}"])
    assert.equal(containsSourceCredential(source, [], "settings.ts"), false, source);
  for (const source of ["const apiKey=process.env.API_KEY || '' + 'private';", "const token=config.token ?? 'private';"])
    assert.equal(containsSourceCredential(source, [], "settings.ts"), true, source);
});

test("comparisons and arrow parameters cannot be confused with credential assignments", () => {
  for (const source of ["if(queryToken === courseToken) return true;", "if(token == currentToken) return;", "const check = token => Boolean(token);", "if (password !== input) return;"])
    assert.equal(containsSourceCredential(source, [], "service.ts"), false, source);
  assert.equal(containsSourceCredential("const token = 'actual-private-value';", [], "service.ts"), true);
  assert.equal(containsSourceCredential("const hasContentToken = (value: string): boolean => value.split(' ').length > 0;", [], "search.ts"), false);
  assert.equal(containsSourceCredential("const getToken = (): string => 'actual-private-value';", [], "search.ts"), true);
});

test("JSX component bindings with authentication names are source functions while literal credential getters and nested secrets stay blocked", () => {
  for (const source of ["const ForgotPassword = ({onBack}: Props) => {return <form><button onClick={onBack}>Back</button></form>};", "const ResetPassword = () => {const [value,setValue]=useState(''); return <main>{value}</main>};", "const AccessToken = () => ready ? <main>Ready</main> : null;"])
    assert.equal(containsSourceCredential(source, [], "component.tsx"),false,source);
  for (const source of ["const ResetPassword = () => 'actual-private-value';", "const ResetPassword='actual-private-value';", "const ResetPassword = () => { const apiKey='actual-private-value';return <main/>};", "const ResetPassword = () => {if(ready)return <main/>;return 'actual-private-value';}"])
    assert.equal(containsSourceCredential(source, [], "component.tsx"),true,source);
  assert.equal(containsSourceCredential("const ResetPassword=()=> <main>installed-private-value</main>;",["installed-private-value"],"component.tsx"),true);
});

test("switch labels, type metadata and runtime references are separated from hardcoded credentials", () => {
  for (const source of ["switch(code){case 'invalid_api_key': case 'forbidden': return false;}", "interface Config { apiKey: string | null; token?: string; }", "const token = (config.token as string)!;", "const authorization = request.get('Authorization');", "const token=tokens.find(t=>t.length>=4);", `const detail = \`token="\${mixedToken}" total=\${hits.length}\`;`, `const auth = \`Bearer \${accessToken}\`;`])
    assert.equal(containsSourceCredential(source, [], "service.ts"), false, source);
  for (const source of ["const apiKey = decode('actual-private-value');", "const token=config.token ?? 'actual-private-value';", "const authorization=request.get('actual-private-value');", 'const detail = `token="actual-private-value"`;', "switch(code){case 'Bearer actual-private-value': return false;}"])
    assert.equal(containsSourceCredential(source, [], "service.ts"), true, source);
  assert.equal(containsSourceCredential("switch(code){case 'actual-private-value': return false;}", ["actual-private-value"], "service.ts"), true);
  assert.equal(containsSourceCredential(`headers.Authorization = \`Bearer \${jwtToken}\`;`, [], "service.ts"), false);
  assert.equal(containsSourceCredential("headers.Authorization = 'Bearer ' + jwtToken;", [], "service.ts"), false);
  assert.equal(containsSourceCredential("headers.Authorization = 'Bearer actual-private-value';", [], "service.ts"), true);
  assert.equal(containsSourceCredential(`function header(userId:string){return \`Bearer \${jwt.sign({sub:userId}, secret, {expiresIn:"15m"})}\`;}`, [], "service.ts"), false);
  assert.equal(containsSourceCredential(`function header(userId:string){return \`Bearer \${jwt.sign({sub:userId}, "actual-private-value", {expiresIn:"15m"})}\`;}`, [], "service.ts"), true);
  assert.equal(containsSourceCredential("authorization = new Headers(init?.headers).get('Authorization') ?? '';", [], "service.ts"), false);
  assert.equal(containsSourceCredential("expect(header).toBe('Bearer test-token');", [], "testing/auth.test.ts"), false);
  assert.equal(containsSourceCredential("expect(header).toBe('Bearer test-token');", ["test-token"], "testing/auth.test.ts"), true);
  assert.equal(containsSourceCredential("header='Bearer test-token';", [], "service.ts"), true);
  assert.equal(containsSourceCredential("const TEST_SECRET='fixture-auth-secret';", [], "testing/auth.test.ts"), false);
  assert.equal(containsSourceCredential("const TEST_SECRET='fixture-auth-secret';", ["fixture-auth-secret"], "testing/auth.test.ts"), true);
  assert.equal(containsSourceCredential("const TEST_SECRET='sk_test_sensitive';", [], "testing/auth.test.ts"), true);
  assert.equal(containsSourceCredential("schema.validate({password:'ValidPassword123!',token:'sample'});", [], "unit/auth.test.ts"), false);
  assert.equal(containsSourceCredential("schema.validate({password:'ValidPassword123!'});", ["ValidPassword123!"], "unit/auth.test.ts"), true);
  assert.equal(containsSourceCredential("const password='ValidPassword123!';", [], "service.ts"), true);
  assert.equal(containsSourceCredential("const apiKey='actual-private-value';", [], "unit/auth.test.ts"), true);
});

test("localized labels and non-executable symbolic SQL connection examples are not credentials", () => {
  const text = JSON.stringify({ password: "رمز عبور", newPassword: "New password", token: "Token" });
  assert.equal(containsSourceCredential(text, [], "src/locales/fa/translation.json"), false);
  assert.equal(containsSourceCredential(text, ["New password"], "src/locales/fa/translation.json"), true);
  assert.equal(containsSourceCredential('{"apiKey":"sk-actualprivatevalueforregression"}', [], "src/locales/fa/translation.json"), true);
  assert.equal(containsSourceCredential(text, [], "config.json"), true);
  assert.equal(containsSourceCredential('-- psql "postgresql://postgres:PASSWORD@HOST:PORT/DB?sslmode=require"', [], "migration.sql"), false);
  assert.equal(containsSourceCredential('-- psql "postgresql://postgres:actual-private@db.example.test:5432/app"', [], "migration.sql"), true);
});

test("test-file names never exempt arbitrary short tokens, passwords or real service URLs", () => {
  for (const source of ["const token='do-not-publish';", "const password='actual-private-value';", "const config={password:'actual-private-value'};", "const config={token:'short-secret'};", "const config={authorization:'Bearer short-secret'};", "const input='https://user:password@actual-service.com';", "const token=1234;"])
    assert.equal(containsSourceCredential(source, [], "unit/auth.test.ts"), true, source);
  assert.equal(containsSourceCredential("const password='ValidPassword123!';", [], "unit/auth.test.ts"), true);
  assert.equal(containsSourceCredential("const sample={password:'ValidPassword123!'};", [], "unit/auth.test.ts"), false);
});

test("JWT signing distinguishes public claims from the key and keeps real keys blocked", () => {
  const signed = "const resetToken=jwt.sign({email,type:'reset',iat:123,version:2},jwtSecret,{expiresIn:'30d'} as SignOptions);";
  assert.equal(containsSourceCredential(signed, [], "auth.ts"), false);
  assert.equal(containsSourceCredential(signed, ["jwtSecret"], "auth.ts"), true);
  for (const source of [signed.replace("jwtSecret", "'actual-private-value'"), "const resetToken=jwt.sign({secret:'actual-private-value'},jwtSecret);", "const secret=1234;"])
    assert.equal(containsSourceCredential(source, [], "auth.ts"), true, source);
});

test("SQL placeholders and conditional colons are syntax while adjacent literal credentials remain blocked", () => {
  for (const source of ['pool.query("UPDATE users SET password_hash=$2 WHERE id=$1",[id,hash]);', "pool.query(`UPDATE users SET password_hash = $2 WHERE id=$1`,[id,hash]);", 'pool.query("UPDATE users SET password_hash = COALESCE($2, password_hash) WHERE id=$1",[id,hash]);', "const email=data.password ? data.password : 'Use the reset link';", "const label=isFa ? 'رمز عبور:' : 'Set a new password:';"])
    assert.equal(containsSourceCredential(source, [], "service.ts"), false, source);
  for (const source of ['pool.query("UPDATE users SET password_hash=actual-private-value WHERE token=$2",[id]);', "const password=available ? config.password : 'actual-private-value';", "const email=data.password ? data.password : 'Bearer actual-private-value';"])
    assert.equal(containsSourceCredential(source, [], "service.ts"), true, source);
  assert.equal(containsSourceCredential('pool.query("UPDATE users SET password_hash=$2",[hash]);', ["users"], "service.ts"), true);
  assert.equal(containsSourceCredential('pool.query("UPDATE users SET password_hash=COALESCE(actual-private-value,password_hash)",[id]);', [], "service.ts"), true);
});

test("a template exception cannot hide an installed secret or a credential with a template prefix", () => {
  assert.equal(containsSourceCredential("apiKey=YOUR_API_KEY", ["YOUR_API_KEY"]), true);
  for (const value of ["YOUR_API_KEY_realCredential123", "YOUR_KEY123", "your_api_key", "YOUR_KEY-extra", "real-value-123", "YOUR_ARBITRARY_VALUE"]) {
    assert.equal(containsSourceCredential(`apiKey=${value}`), true, value);
  }
  assert.equal(containsSourceCredential("Authorization: Bearer YOUR_ACCESS_TOKEN"), true);
  assert.equal(containsSourceCredential("https://user:YOUR_PASSWORD@example.com"), true);
});

test("log redaction remains conservative even for setup-template strings", () => {
  assert.equal(redact('apiKey="YOUR_API_KEY"'), 'apiKey="[REDACTED]"');
  assert.equal(redact("token=YOUR_ACCESS_TOKEN"), "token=[REDACTED]");
});

test("compiled boolean metadata is not a source credential, while literal and installed values remain blocked", () => {
  for (const value of ["!0", "!1", "true", "false", "null", "undefined"]) assert.equal(containsSourceCredential(`const inputTypes={password:${value}}`), false);
  assert.equal(containsSourceCredential('password:"false"'), true);
  assert.equal(containsSourceCredential('password:false', ['false']), true);
  assert.equal(redact('password:!0'), 'password:[REDACTED]');
});
