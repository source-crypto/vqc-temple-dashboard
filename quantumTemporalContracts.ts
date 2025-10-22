#!/usr/bin/env node
/**
 * dedupe-contracts.js
 *
 * Small Node script to automatically fix two classes of problems that
 * commonly cause the "failed to parse app: `api` already imported" and
 * "api endpoints with conflicting names/paths" errors in a generated
 * TypeScript file such as packages/backend/blockchain/contracts.ts:
 *
 * 1) Duplicate imports from the same module (e.g. multiple lines importing
 *    { api, APIError } from "encore.dev/api"; duplicated further down).
 *    The script merges them into a single import per module and removes
 *    duplicate specifiers.
 *
 * 2) Duplicate exported api endpoint definitions with the same exported
 *    identifier (e.g. export const deployVQCInfrastructure = api<...>(...);)
 *    The script keeps the first occurrence and removes subsequent duplicate
 *    definitions (determined by the exported identifier).
 *
 * This is a pragmatic fix-for-now tool to help clean generated/concatenated
 * files. It's conservative: it backs up the original file before writing.
 *
 * Usage:
 *   node scripts/dedupe-contracts.js path/to/contracts.ts
 *
 * Example:
 *   node scripts/dedupe-contracts.js packages/backend/blockchain/contracts.ts
 *
 * NOTE:
 * - This script uses simple source-based heuristics (regex + paren balancing).
 * - It is not a full TypeScript parser. For complex cases consider using
 *   a proper parser (ts-morph / @babel/parser).
 */

const fs = require("fs");
const path = require("path");

if (process.argv.length < 3) {
  console.error("Usage: node scripts/dedupe-contracts.js path/to/contracts.ts");
  process.exit(2);
}

const targetPath = process.argv[2];
if (!fs.existsSync(targetPath)) {
  console.error("File not found:", targetPath);
  process.exit(2);
}

const original = fs.readFileSync(targetPath, "utf8");

// 1) Merge duplicate imports
function mergeImports(source) {
  // Regex to match import statements (very permissive)
  // Captures:
  // 1: import head (everything after "import " up to " from")
  // 2: module specifier
  const importRegex = /^\s*import\s+(.+?)\s+from\s+(['"])(.+?)\2\s*;?\s*$/gm;

  const importsByModule = new Map();
  const importOrder = [];

  let m;
  while ((m = importRegex.exec(source)) !== null) {
    const full = m[0];
    const head = m[1].trim();
    const moduleName = m[3];

    if (!importsByModule.has(moduleName)) {
      importsByModule.set(moduleName, {
        rawHeads: [],
        combined: null,
        firstIndex: m.index,
      });
      importOrder.push(moduleName);
    }
    importsByModule.get(moduleName).rawHeads.push(head);
  }

  if (importsByModule.size === 0) {
    // nothing to do
    return source;
  }

  // Build replacement imports
  const rebuiltImports = [];
  for (const moduleName of importOrder) {
    const info = importsByModule.get(moduleName);
    // Parse each head to find default, named, namespace imports
    let defaultName = null;
    const namedSet = new Set();
    let namespaceName = null;

    for (const head of info.rawHeads) {
      // Examples of head:
      // defaultName
      // { a, b as c }
      // * as ns
      // defaultName, { a, b }
      const parts = head.split(",");
      for (let p of parts) {
        p = p.trim();
        if (!p) continue;
        if (p.startsWith("{") && p.endsWith("}")) {
          // named import
          const inner = p.slice(1, -1);
          const names = inner.split(",").map(s => s.trim()).filter(Boolean);
          for (const name of names) {
            // normalize "a as b" -> "a as b"
            namedSet.add(name);
          }
        } else if (p.startsWith("* as ")) {
          namespaceName = p.replace("* as ", "").trim();
        } else {
          // default import (or maybe default + named handled above)
          defaultName = p;
        }
      }
    }

    let rebuilt = "import ";
    const partsOut = [];
    if (defaultName) partsOut.push(defaultName);
    if (namespaceName) partsOut.push(`* as ${namespaceName}`);
    if (namedSet.size > 0) {
      const namedArr = Array.from(namedSet);
      partsOut.push(`{ ${namedArr.join(", ")} }`);
    }
    rebuilt += partsOut.join(", ") + ` from "${moduleName}";`;
    rebuiltImports.push(rebuilt);
  }

  // Replace *all* original import statements with the rebuilt block.
  // To do that: remove all import lines matched earlier and then insert rebuilt imports
  const sourceWithoutImports = source.replace(importRegex, "").trimStart();

  const newSource = rebuiltImports.join("\n") + "\n\n" + sourceWithoutImports;
  return newSource;
}

// 2) Remove duplicate exported api declarations
function removeDuplicateApiExports(source) {
  // Find occurrences of `export const <name> = api` or `export const <name> = api<`
  const exportApiRegex = /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*api\b/g;

  const seen = new Set();
  let out = "";
  let cursor = 0;
  let m;

  while ((m = exportApiRegex.exec(source)) !== null) {
    const name = m[1];
    const startIdx = m.index;

    if (!seen.has(name)) {
      // keep the first occurrence: append everything from cursor to next match start,
      // but we'll need to advance cursor past this api(...) expression.
      // Find the full api(...) expression end.
      // Locate the '(' that starts the call (first '(' after "api").
      const idxAfterApi = source.indexOf("api", startIdx) + 3;
      const parenIdx = source.indexOf("(", idxAfterApi);
      if (parenIdx === -1) {
        // malformed, just skip
        exportApiRegex.lastIndex = startIdx + 1;
        seen.add(name);
        continue;
      }
      // balance parentheses to find the closing ')'
      let i = parenIdx;
      let depth = 0;
      let foundClose = -1;
      const len = source.length;
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inTemplate = false;
      let inCommentLine = false;
      let inCommentBlock = false;
      for (; i < len; i++) {
        const ch = source[i];
        const two = source.substr(i, 2);

        // simple comment / string guards to avoid counting parens inside strings/comments
        if (!inCommentBlock && !inCommentLine && !inSingleQuote && !inDoubleQuote && ch === "`") {
          inTemplate = !inTemplate;
          continue;
        }
        if (!inCommentBlock && !inCommentLine && !inSingleQuote && !inDoubleQuote && ch === "'") {
          inSingleQuote = !inSingleQuote;
          continue;
        }
        if (!inCommentBlock && !inCommentLine && !inSingleQuote && !inTemplate && ch === '"') {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
        if (!inSingleQuote && !inDoubleQuote && !inTemplate && two === "//") {
          inCommentLine = true;
          i++; // advance one more to skip second char
          continue;
        }
        if (!inSingleQuote && !inDoubleQuote && !inTemplate && two === "/*") {
          inCommentBlock = true;
          i++;
          continue;
        }
        if (inCommentLine && ch === "\n") {
          inCommentLine = false;
          continue;
        }
        if (inCommentBlock && two === "*/") {
          inCommentBlock = false;
          i++;
          continue;
        }
        if (inSingleQuote || inDoubleQuote || inTemplate || inCommentLine || inCommentBlock) {
          continue;
        }

        if (ch === "(") {
          depth++;
        } else if (ch === ")") {
          depth--;
          if (depth === 0) {
            foundClose = i;
            break;
          }
        }
      }

      if (foundClose === -1) {
        // can't find closing ), keep scanning but don't attempt to remove
        exportApiRegex.lastIndex = startIdx + 1;
        seen.add(name);
        continue;
      }

      // also attempt to include trailing semicolon and surrounding whitespace/newlines
      let endIdx = foundClose + 1;
      // consume any trailing whitespace, semicolon, and newlines
      while (endIdx < source.length && /\s|;/.test(source[endIdx])) endIdx++;

      // append everything from cursor to endIdx for this kept export
      out += source.substring(cursor, endIdx);
      cursor = endIdx;
      seen.add(name);
      // continue scanning from current position
      exportApiRegex.lastIndex = cursor;
    } else {
      // duplicate: remove this entire export api(...) block
      // find the '(' after api and locate its matching ')', same as above
      const idxAfterApi = source.indexOf("api", startIdx) + 3;
      const parenIdx = source.indexOf("(", idxAfterApi);
      if (parenIdx === -1) {
        // skip this match and continue
        exportApiRegex.lastIndex = startIdx + 1;
        continue;
      }
      // balance parentheses
      let i = parenIdx;
      let depth = 0;
      const len = source.length;
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inTemplate = false;
      let inCommentLine = false;
      let inCommentBlock = false;
      let foundClose = -1;
      for (; i < len; i++) {
        const ch = source[i];
        const two = source.substr(i, 2);
        if (!inCommentBlock && !inCommentLine && !inSingleQuote && !inDoubleQuote && ch === "`") {
          inTemplate = !inTemplate;
          continue;
        }
        if (!inCommentBlock && !inCommentLine && !inSingleQuote && !inTemplate && ch === "'") {
          inSingleQuote = !inSingleQuote;
          continue;
        }
        if (!inCommentBlock && !inCommentLine && !inSingleQuote && !inTemplate && ch === '"') {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }
        if (!inSingleQuote && !inDoubleQuote && !inTemplate && two === "//") {
          inCommentLine = true;
          i++;
          continue;
        }
        if (!inSingleQuote && !inDoubleQuote && !inTemplate && two === "/*") {
          inCommentBlock = true;
          i++;
          continue;
        }
        if (inCommentLine && ch === "\n") {
          inCommentLine = false;
          continue;
        }
        if (inCommentBlock && two === "*/") {
          inCommentBlock = false;
          i++;
          continue;
        }
        if (inSingleQuote || inDoubleQuote || inTemplate || inCommentLine || inCommentBlock) {
          continue;
        }

        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            foundClose = i;
            break;
          }
        }
      }

      if (foundClose === -1) {
        // can't find closing, skip
        exportApiRegex.lastIndex = startIdx + 1;
        continue;
      }

      let endIdx = foundClose + 1;
      while (endIdx < source.length && /\s|;/.test(source[endIdx])) endIdx++;

      // We are removing [startIdx .. endIdx)
      // Append the chunk between cursor and startIdx (kept content), but skip the duplicate chunk
      out += source.substring(cursor, startIdx);
      cursor = endIdx;
      exportApiRegex.lastIndex = cursor;
    }
  }

  // append the rest
  out += source.substring(cursor);
  return out;
}

// Run transformations
try {
  let transformed = mergeImports(original);
  transformed = removeDuplicateApiExports(transformed);

  // If nothing changed, inform the user and exit
  if (transformed === original) {
    console.log("No changes necessary (no duplicate imports or duplicate api exports found).");
    process.exit(0);
  }

  // backup original
  const backupPath = targetPath + ".bak-" + Date.now();
  fs.writeFileSync(backupPath, original, "utf8");
  fs.writeFileSync(targetPath, transformed, "utf8");

  console.log("Updated file written to:", targetPath);
  console.log("Backup of original written to:", backupPath);
  console.log("Please run type-check/build to confirm everything still compiles.");
} catch (err) {
  console.error("Error while processing file:", err);
  process.exit(1);
}
