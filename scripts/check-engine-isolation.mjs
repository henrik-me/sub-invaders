#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const TOOL_NAME = 'check-engine-isolation';
const DEFAULT_DIR = path.join('src', 'engine');
const STATIC_IMPORT_RE = /^[\t ]*import(?:\s*(['"])(?<side>[^'"\r\n]*)\1|\s+(?:(?!^[\t ]*import\b)[\s\S])*?\s+from\s*(['"])(?<from>[^'"\r\n]*)\2)/gm;
const IMPORT_START_RE = /^[\t ]*import\b/gm;

function usageText() {
  return [
    'Usage: node scripts/check-engine-isolation.mjs [options]',
    '',
    'Fail-closed static import boundary linter for engine modules.',
    '',
    'Options:',
    '  --dir <path>  Directory to scan, relative to the current working directory',
    '                (default: src/engine; repeatable)',
    '  --quiet       Suppress success output',
    '  --help        Print this help text',
    '',
    'Exit codes:',
    '  0  no boundary violations',
    '  1  boundary violation or read/parse error',
    '  2  usage error',
    '',
  ].join('\n');
}

function printUsage(stream) {
  stream.write(usageText());
}

function requireValue(args, i, name) {
  const next = args[i + 1];
  if (!next || next.startsWith('-')) {
    process.stderr.write(`${TOOL_NAME}: missing value for ${name}\n`);
    printUsage(process.stderr);
    process.exit(2);
  }
  return next;
}

function parseArgs(args) {
  const dirArgs = [];
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dir') {
      dirArgs.push(requireValue(args, i, '--dir'));
      i++;
    } else if (arg === '--quiet') {
      quiet = true;
    } else if (arg === '--help') {
      printUsage(process.stdout);
      process.exit(0);
    } else {
      process.stderr.write(`${TOOL_NAME}: unknown flag: ${arg}\n`);
      printUsage(process.stderr);
      process.exit(2);
    }
  }

  return {
    dirArgs: dirArgs.length === 0 ? [DEFAULT_DIR] : dirArgs,
    quiet,
  };
}

function displayPath(filePath) {
  return path.normalize(filePath);
}

function parseFailure(message, line) {
  const error = new Error(message);
  error.line = line;
  return error;
}

function sanitizeForImportScan(source) {
  let sanitized = '';
  let state = 'code';
  let quote = null;
  let escaped = false;
  let stateStartLine = 1;
  let line = 1;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'code') {
      if (ch === '/' && next === '/') {
        sanitized += '  ';
        i++;
        state = 'line-comment';
      } else if (ch === '/' && next === '*') {
        sanitized += '  ';
        i++;
        state = 'block-comment';
        stateStartLine = line;
      } else if (ch === '\'' || ch === '"') {
        sanitized += ch;
        quote = ch;
        escaped = false;
        state = 'string';
        stateStartLine = line;
      } else if (ch === '`') {
        sanitized += ch;
        escaped = false;
        state = 'template';
        stateStartLine = line;
      } else {
        sanitized += ch;
      }
    } else if (state === 'line-comment') {
      if (ch === '\n' || ch === '\r') {
        sanitized += ch;
        state = 'code';
      } else {
        sanitized += ' ';
      }
    } else if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        sanitized += '  ';
        i++;
        state = 'code';
      } else if (ch === '\n' || ch === '\r') {
        sanitized += ch;
      } else {
        sanitized += ' ';
      }
    } else if (state === 'string') {
      sanitized += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        state = 'code';
      } else if (ch === '\n' || ch === '\r') {
        throw parseFailure('unterminated string literal', stateStartLine);
      }
    } else if (state === 'template') {
      sanitized += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '`') {
        state = 'code';
      }
    }

    if (ch === '\n') {
      line++;
    }
  }

  if (state === 'block-comment') {
    throw parseFailure('unterminated block comment', stateStartLine);
  }
  if (state === 'string') {
    throw parseFailure('unterminated string literal', stateStartLine);
  }
  if (state === 'template') {
    throw parseFailure('unterminated template literal', stateStartLine);
  }

  return sanitized;
}

function lineNumberForIndex(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') {
      line++;
    }
  }
  return line;
}

function isInsideRange(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function parseStaticImports(source) {
  let sanitized;
  try {
    sanitized = sanitizeForImportScan(source);
  } catch (err) {
    return {
      imports: [],
      parseErrors: [{ line: err.line ?? 1, message: `unable to parse JavaScript: ${err.message}` }],
    };
  }

  const imports = [];
  const matchedRanges = [];

  for (const match of sanitized.matchAll(STATIC_IMPORT_RE)) {
    const specifier = match.groups.side ?? match.groups.from;
    imports.push({ specifier, line: lineNumberForIndex(source, match.index) });
    matchedRanges.push([match.index, match.index + match[0].length]);
  }

  const parseErrors = [];
  for (const match of sanitized.matchAll(IMPORT_START_RE)) {
    if (isInsideRange(match.index, matchedRanges)) {
      continue;
    }

    const keywordIndex = match.index + match[0].lastIndexOf('import');
    const afterImport = sanitized[keywordIndex + 'import'.length];
    if (afterImport === '.' || afterImport === '(') {
      continue;
    }

    parseErrors.push({
      line: lineNumberForIndex(source, keywordIndex),
      message: 'unable to parse static import statement',
    });
  }

  return { imports, parseErrors };
}

function isRelativeSpecifier(specifier) {
  return specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier.startsWith('.\\') ||
    specifier.startsWith('..\\');
}

function isAbsoluteSpecifier(specifier) {
  return path.isAbsolute(specifier) ||
    specifier.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(specifier);
}

function isInsideDirectory(targetPath, dirPath) {
  const relative = path.relative(dirPath, targetPath);
  return relative === '' || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function isInsideAnyDirectory(targetPath, engineDirs) {
  return engineDirs.some((dirPath) => isInsideDirectory(targetPath, dirPath));
}

function collectMjsFiles(engineDirs) {
  const files = [];
  const errors = [];

  for (const dirPath of engineDirs) {
    let stat;
    try {
      stat = fs.statSync(dirPath);
    } catch (err) {
      const message = err.code === 'ENOENT'
        ? `error: directory not found: ${displayPath(dirPath)}`
        : `error: cannot access directory ${displayPath(dirPath)}: ${err.message}`;
      errors.push(message);
      continue;
    }

    if (!stat.isDirectory()) {
      errors.push(`error: not a directory: ${displayPath(dirPath)}`);
      continue;
    }

    walkDirectory(dirPath, files, errors);
  }

  return { files: [...new Set(files)].sort(), errors };
}

function walkDirectory(dirPath, files, errors) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    errors.push(`error: cannot read directory ${displayPath(dirPath)}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(entryPath, files, errors);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(path.resolve(entryPath));
    }
  }
}

function reportOutsideViolation(filePath, line, specifier, targetPath) {
  process.stderr.write(
    `error: ${displayPath(filePath)}:${line}: import "${specifier}" resolves to ` +
    `${displayPath(targetPath)} outside engine directories\n`
  );
}

function reportForbiddenGameImport(filePath, line, specifier) {
  process.stderr.write(
    `error: ${displayPath(filePath)}:${line}: import "${specifier}" contains forbidden src/game/ path\n`
  );
}

function run() {
  const { dirArgs, quiet } = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const engineDirs = dirArgs.map((dirArg) => path.resolve(cwd, dirArg));
  const { files, errors } = collectMjsFiles(engineDirs);
  let failureCount = 0;

  for (const error of errors) {
    process.stderr.write(`${error}\n`);
    failureCount++;
  }

  for (const filePath of files) {
    let source;
    try {
      source = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      process.stderr.write(`error: ${displayPath(filePath)}: cannot read file: ${err.message}\n`);
      failureCount++;
      continue;
    }

    const { imports, parseErrors } = parseStaticImports(source);
    for (const parseError of parseErrors) {
      process.stderr.write(
        `error: ${displayPath(filePath)}:${parseError.line}: ${parseError.message}\n`
      );
      failureCount++;
    }

    for (const importInfo of imports) {
      const { specifier, line } = importInfo;
      if (specifier.includes('src/game/')) {
        reportForbiddenGameImport(filePath, line, specifier);
        failureCount++;
        continue;
      }

      if (isAbsoluteSpecifier(specifier)) {
        reportOutsideViolation(filePath, line, specifier, path.resolve(specifier));
        failureCount++;
        continue;
      }

      if (!isRelativeSpecifier(specifier)) {
        continue;
      }

      const targetPath = path.resolve(path.dirname(filePath), specifier);
      if (!isInsideAnyDirectory(targetPath, engineDirs)) {
        reportOutsideViolation(filePath, line, specifier, targetPath);
        failureCount++;
      }
    }
  }

  if (failureCount > 0) {
    process.exit(1);
  }

  if (!quiet) {
    process.stdout.write(
      `${TOOL_NAME}: PASS — ${files.length} .mjs file(s) checked in ` +
      `${engineDirs.length} engine director${engineDirs.length === 1 ? 'y' : 'ies'}.\n`
    );
  }
}

run();
