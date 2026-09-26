// Tester client: node ux.cjs <session> <action> [args...]
// Actions: open · snapshot · click <name> · type [--field "<label>"] <text> [--enter] · select "<label>" <option>
//          · press <key> · wait <ms> · screenshot
// Operator only: "open <scenario> [--viewport WxH]" (start a tester mid-flow or at another size; testers run
// plain "open"), "errors" (page errors in this session), "close" (end a finished session and free its slot).
// Exits non-zero when the harness is unreachable or answers with an ERROR, so shell && chains stop.
// Never calls process.exit(): it sets the exit code and returns, so piped stderr is always flushed.
const fs = require('fs');
const http = require('http');
const { tokenFile } = require('./common.cjs');

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function main() {
  const port = Number(process.env.UX_PORT || 3917);
  const [session, action, ...args] = process.argv.slice(2);
  if (!session || !action) return fail('Usage: node ux.cjs <session> <action> [args...]');

  let token;
  try {
    token = fs.readFileSync(tokenFile(port), 'utf8').trim();
  } catch {
    return fail(`ERROR: harness not running on port ${port} (no token file).`);
  }

  let viewport;
  const vi = action === 'open' ? args.indexOf('--viewport') : -1;
  if (vi !== -1) {
    const m = /^(\d+)x(\d+)$/.exec(args[vi + 1] || '');
    if (!m) return fail('ERROR: --viewport needs WIDTHxHEIGHT, e.g. 400x860.');
    viewport = { width: Number(m[1]), height: Number(m[2]) };
    args.splice(vi, 2);
  }
  if (action === 'open' && args.length > 1) {
    console.error(`warning: "open" takes one scenario; ignoring: ${args.slice(1).join(' ')}`);
  }
  const body = JSON.stringify(
    action === 'open' ? { session, action, scenario: args[0], viewport } : { session, action, args },
  );
  const req = http.request(
    { host: '127.0.0.1', port, method: 'POST', path: '/', headers: { 'x-ux-token': token } },
    (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        if (d.startsWith('ERROR')) fail(d);
        else console.log(d);
      });
    },
  );
  req.on('error', (e) => fail('ERROR: harness not reachable: ' + e.message));
  req.end(body);
}

main();
