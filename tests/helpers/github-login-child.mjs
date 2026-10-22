const scenario = process.argv[2];
const args = process.argv.slice(3);
if (scenario === "oversized") process.stderr.write("x".repeat(17_000));
else if (scenario !== "silent") {
  const copied = !args.includes("--clipboard=false");
  process.stderr.write(copied ? "! One-time code (ABCD-1234) copied to clipboard\n" : "! First copy your one-time code: AB");
  setImmediate(() => {
    if (!copied) process.stderr.write("CD-1234\n");
    if (scenario === "wrong-host") process.stdout.write("Open this URL to continue in your web browser: https://example.com/login/device\n");
    else {
      process.stdout.write("Open this URL to continue in your web browser: https://git");
      setTimeout(() => process.stdout.write("hub.com/login/device\n"), 20);
    }
  });
}
setInterval(() => {}, 1000);
