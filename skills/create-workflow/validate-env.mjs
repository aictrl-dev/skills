import { homedir } from 'node:os';
import { join } from 'node:path';

export function defaultNpmCache(platform = process.platform, env = process.env, home = homedir()) {
  if (platform === 'win32') {
    return env.LOCALAPPDATA
      ? join(env.LOCALAPPDATA, 'npm-cache')
      : join(home, 'AppData', 'Local', 'npm-cache');
  }
  return join(home, '.npm');
}

export function remediationHint(script, file, platform = process.platform) {
  const quote = platform === 'win32'
    ? (value) => '"' + value.replaceAll('"', '""') + '"'
    : (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  return `npx --yes -p ajv@8 -p js-yaml@4 -- node ${quote(script)} ${quote(file)}`;
}
