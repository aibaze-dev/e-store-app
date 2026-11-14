// Shared by the portal and CI. Inspect immutable repository files, never installed
// files or timestamps. Unknown import resolution deliberately disables the fast path.
const { createHash } = require('node:crypto');
const path = require('node:path').posix;

function backendFingerprint(files, ts) {
  const names = Object.keys(files).filter(name => !name.startsWith('convex/_generated/')).sort();
  const included = new Set(names.filter(name => !/^(src\/|public\/|index\.html$)/.test(name)));
  let uncertain = false;
  let pkg;
  try { pkg = JSON.parse(String(files['package.json'])); } catch { uncertain = true; pkg = {}; }
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  if (pkg.imports || pkg.workspaces || Object.values(dependencies).some(value => /^(file:|link:|workspace:)/.test(value))) uncertain = true;
  // Aliases/baseUrl can redirect bare imports into frontend/shared code.
  for (const name of names.filter(name => /(^|\/)tsconfig[^/]*\.jsonc?$/.test(name))) {
    const parsed = ts.parseConfigFileTextToJson(name, String(files[name]));
    if (parsed.error || parsed.config?.extends || parsed.config?.compilerOptions?.paths || parsed.config?.compilerOptions?.baseUrl) uncertain = true;
  }
  const queue = names.filter(name => name.startsWith('convex/') && /\.[cm]?[jt]sx?$/.test(name));
  const visited = new Set();
  const resolve = (from, specifier) => {
    if (!specifier.startsWith('.')) {
      if (/^node:(fs|module)(\/|$)/.test(specifier)) uncertain = true;
      const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (!specifier.startsWith('node:') && !Object.hasOwn(dependencies, packageName)) uncertain = true;
      return;
    }
    const target = path.normalize(path.join(path.dirname(from), specifier));
    if (target.startsWith('convex/_generated/')) return;
    const stem = target.replace(/\.[cm]?jsx?$/, '');
    const candidates = [...new Set([target, ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.json', '/index.ts', '/index.tsx', '/index.js'].map(ext => stem + ext)])];
    const matches = candidates.filter(name => Object.hasOwn(files, name));
    if (!matches.length) uncertain = true;
    for (const name of matches) { included.add(name); queue.push(name); }
  };
  while (queue.length) {
    const name = queue.pop();
    if (visited.has(name) || !/\.[cm]?[jt]sx?$/.test(name)) continue;
    visited.add(name);
    const source = ts.createSourceFile(name, String(files[name]), ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) uncertain = true;
    if (source.referencedFiles.length || source.typeReferenceDirectives.length) uncertain = true;
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) resolve(name, node.moduleSpecifier.text);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        const expression = node.moduleReference.expression;
        if (expression && ts.isStringLiteralLike(expression)) resolve(name, expression.text); else uncertain = true;
      } else if (ts.isImportTypeNode(node)) {
        if (ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) resolve(name, node.argument.literal.text);
        else uncertain = true;
      } else if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(expression) && expression.text === 'require')) {
          if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) resolve(name, node.arguments[0].text);
          else uncertain = true;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const hash = createHash('sha256').update('backend-inputs-v1\0');
  for (const name of names.filter(name => uncertain || included.has(name))) {
    const content = Buffer.from(files[name]);
    hash.update(JSON.stringify([name, content.length])).update('\0').update(content);
  }
  return hash.digest('hex');
}

module.exports = { backendFingerprint };
