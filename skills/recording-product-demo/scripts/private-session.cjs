// Protect local session artifacts on POSIX. These modes do not establish Windows ACL guarantees.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function owned(stat, target) {
  if (typeof process.getuid !== 'function' || stat.uid !== process.getuid()) {
    throw new Error(`Session path is not owned by the current user: ${target}. Use a dedicated directory you own.`);
  }
}

function trustedDirectory(stat, target) {
  if (stat.isSymbolicLink()) throw new Error(`Session path contains a symlink: ${target}. Use a real, dedicated directory.`);
  if (!stat.isDirectory()) throw new Error(`Session path is not a directory: ${target}. Choose a dedicated directory.`);
  if (typeof process.getuid !== 'function' || (stat.uid !== 0 && stat.uid !== process.getuid())) {
    throw new Error(`Session ancestor is not owned by root or the current user: ${target}. Choose a path with trusted ancestors.`);
  }
  if ((stat.mode & 0o022) && !(stat.mode & 0o1000)) {
    throw new Error(`Session ancestor is writable by other users without the sticky bit: ${target}. Choose a trusted path; shared ancestors will not be chmodded.`);
  }
}

function directoryChain(target, create) {
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  let current = root;
  trustedDirectory(fs.lstatSync(root), root);
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code !== 'ENOENT' || !create) throw error;
      fs.mkdirSync(current, { mode: 0o700 });
      stat = fs.lstatSync(current);
      // mkdir's mode is filtered by umask. Only adjust a directory we just created and own.
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`New session directory was replaced: ${current}`);
      owned(stat, current);
      fs.chmodSync(current, 0o700);
      stat = fs.lstatSync(current);
    }
    trustedDirectory(stat, current);
  }
  return absolute;
}

function privateDirectory(target) {
  const absolute = directoryChain(target, true);
  const stat = fs.lstatSync(absolute);
  owned(stat, absolute);
  if ((stat.mode & 0o777) !== 0o700) {
    throw new Error(`Session directory must be private (0700): ${absolute}. Review its contents and set chmod 700, or choose a new dedicated directory.`);
  }
  return absolute;
}

function stateDestination(target) {
  const absolute = path.resolve(target);
  directoryChain(path.dirname(absolute), false);
  let stat;
  try { stat = fs.lstatSync(absolute); } catch (error) {
    if (error.code === 'ENOENT') return absolute;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Session state is a symlink: ${absolute}. Choose a regular file in a private directory.`);
  if (!stat.isFile()) throw new Error(`Session state is not a regular file: ${absolute}. Choose a regular file in a private directory.`);
  owned(stat, absolute);
  if ((stat.mode & 0o777) !== 0o600) {
    throw new Error(`Session state must have mode 0600: ${absolute}. Review the file and set chmod 600, or choose a fresh state path.`);
  }
  return absolute;
}

function prepareSessionPaths(profile, state) {
  if (process.platform === 'win32') {
    throw new Error('Private demo session capture requires POSIX permissions; Windows ACL protection is not implemented. Use a supported POSIX environment.');
  }
  const stateDir = privateDirectory(path.dirname(path.resolve(state)));
  const statePath = stateDestination(state);
  const profileDir = privateDirectory(profile);
  return { profileDir, statePath, stateDir };
}

function writeSessionState(target, state) {
  privateDirectory(path.dirname(path.resolve(target)));
  const destination = stateDestination(target);
  const temporary = path.join(path.dirname(destination), `.session-${randomUUID()}.json`);
  const descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try {
    let writeError;
    try {
      fs.fchmodSync(descriptor, 0o600); // restore owner bits stripped by a restrictive umask before writing
      fs.writeFileSync(descriptor, JSON.stringify(state));
      fs.fsyncSync(descriptor);
    } catch (error) {
      writeError = error;
      throw error;
    } finally {
      try { fs.closeSync(descriptor); } catch (error) {
        if (!writeError) throw error;
        console.error('[login] ERROR: session file close failed:', error.message);
      }
    }
    stateDestination(destination);
    fs.renameSync(temporary, destination);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch (cleanupError) {
      throw new Error(`${error.message}; temporary session cleanup failed for ${temporary}: ${cleanupError.message}`, { cause: error });
    }
    throw error;
  }
}

module.exports = { prepareSessionPaths, writeSessionState };
