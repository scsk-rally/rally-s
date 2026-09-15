import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.cwd(), process.argv[2] || '.');
const files = fs.readdirSync(root, { withFileTypes: true });
const htmlFiles = files.filter((entry) => entry.isFile() && /\.html?$/i.test(entry.name)).map((entry) => entry.name).sort();
const jsDir = path.join(root, 'js');
const jsFiles = fs.readdirSync(jsDir).filter((name) => /\.js$/i.test(name)).map((name) => `js/${name}`).sort();
const findings = [];

function add(severity, code, file, detail) {
  findings.push({ severity, code, file, detail });
}

function localTarget(file, raw) {
  const value = String(raw || '').trim();
  if (!value || /^(?:https?:|mailto:|tel:|data:|javascript:|about:|#|\/\/)/i.test(value)) return null;
  const clean = decodeURIComponent(value.split('#')[0].split('?')[0]);
  if (!clean) return null;
  return path.resolve(path.dirname(path.join(root, file)), clean);
}

for (const file of htmlFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) add('error', 'duplicate-id', file, `重複ID: ${id}`);
    seen.add(id);
  }

  if (!/<html\b[^>]*\blang=["']ja["']/i.test(source)) add('warning', 'missing-lang', file, 'html要素にlang="ja"がありません。');
  if (!/<meta\b[^>]*charset=["']?utf-8/i.test(source)) add('error', 'missing-charset', file, 'UTF-8指定がありません。');
  if (!/<meta\b[^>]*name=["']viewport["']/i.test(source)) add('warning', 'missing-viewport', file, 'viewport指定がありません。');
  if (!/<title>[^<]+<\/title>/i.test(source)) add('error', 'missing-title', file, 'title要素が空またはありません。');
  if (/�/.test(source)) add('error', 'replacement-character', file, '文字化けを示す置換文字が含まれます。');

  for (const match of source.matchAll(/\b(?:href|src|poster)=["']([^"']*)["']/gi)) {
    const target = localTarget(file, match[1]);
    if (target && !fs.existsSync(target)) add('error', 'missing-local-target', file, `${match[1]} が存在しません。`);
  }

  for (const match of source.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) add('warning', 'missing-alt', file, `alt属性がない画像: ${match[0].slice(0, 120)}`);
  }

  const placeholderPatterns = [
    ['example-domain', /https?:\/\/(?:www\.)?example\.com/gi],
    ['placeholder-text', /(?:TODO|FIXME|XXX|仮リンク)/g],
    ['local-url', /https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/gi]
  ];
  for (const [code, pattern] of placeholderPatterns) {
    const matches = source.match(pattern);
    if (matches) add('warning', code, file, `要確認: ${[...new Set(matches)].join(', ')}`);
  }
}

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) add('error', 'javascript-syntax', file, (result.stderr || result.stdout).trim());
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/�/.test(source)) add('error', 'replacement-character', file, '文字化けを示す置換文字が含まれます。');
  if (/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(source)) add('warning', 'local-url', file, 'ローカル開発URLが含まれます。');
}

const cssFile = 'css/style.css';
const css = fs.readFileSync(path.join(root, cssFile), 'utf8');
for (const match of css.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/gi)) {
  const target = localTarget(cssFile, match[1].trim());
  if (target && !fs.existsSync(target)) add('error', 'missing-css-target', cssFile, `${match[1]} が存在しません。`);
}

const summary = {
  checkedAt: new Date().toISOString(),
  htmlFiles: htmlFiles.length,
  jsFiles: jsFiles.length,
  errors: findings.filter((item) => item.severity === 'error').length,
  warnings: findings.filter((item) => item.severity === 'warning').length,
  findings
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.errors ? 1 : 0;
