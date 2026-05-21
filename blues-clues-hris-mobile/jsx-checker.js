const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);

// Minimal JSX parser/checker
files.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Strip comments: {/* ... */} and // ... and /* ... */
  let stripped = content
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // remove JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, '')     // remove multi-line comments
    .replace(/\/\/.*/g, '');              // remove single-line comments

  // Let's scan for JSX blocks.
  // We can search for tags and check their children.
  // To keep it robust, let's find all occurrences of:
  // <SomeTag ...> children </SomeTag>
  // where SomeTag is NOT Text/TextInput, and check if children contains raw text or expressions.
  
  // A simple way is to find JSX tags and extract what is between > and <
  // E.g., <View ...> HERE </View>
  // Let's find all >...< sequences.
  
  let pos = 0;
  const len = stripped.length;
  
  // Track open tag stack
  // Each stack entry is { name, line, charIndex }
  const tagStack = [];
  
  // Let's find tags using a state machine or regex.
  // A regex can find all tags: <(\/?[A-Za-z0-9_.-]+)
  // Let's find all tags, comments are already stripped.
  const tagRegex = /<(\/?[A-Za-z0-9_.-]+)(\s+[^>]*)?\/?>/g;
  let match;
  
  // We want to find any text between a closing angle bracket '>' of an opening tag
  // and the opening angle bracket '<' of the next tag.
  // E.g., >TEXT<
  // Let's find all such gaps.
  const gapRegex = />([^<]*)</g;
  while ((match = gapRegex.exec(stripped)) !== null) {
    const text = match[1];
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      // We found text between tags! E.g. >Hello<
      // Now, let's see what is the current tag context or if it's an expression/string.
      // Wait, is it inside a Text component or other allowed component?
      // Let's trace back from the match index to find the last opening tag.
      const matchIndex = match.index;
      const lastTag = getOpeningTagAt(stripped, matchIndex);
      
      if (lastTag && !isTextTag(lastTag)) {
        // If it's a JS expression like {someVar}, let's check it.
        // If it's a raw string, it's definitely a crash!
        const line = getLineNumber(content, matchIndex);
        console.log(`[CRASH RISK] Bare text/expression "${trimmed}" inside non-text tag <${lastTag}> at ${path.basename(filePath)}:${line}`);
      }
    }
  }
});

function getOpeningTagAt(code, index) {
  // Trace back from index to find the most recent unclosed or currently open tag.
  // For simplicity, find the last '<' before index.
  const sub = code.substring(0, index);
  const tags = [...sub.matchAll(/<(\/?[A-Za-z0-9_.-]+)/g)];
  if (tags.length === 0) return null;
  
  // Let's rebuild the stack of open tags up to the index
  const stack = [];
  for (const match of tags) {
    const tagName = match[1];
    if (tagName.startsWith('/')) {
      const closingName = tagName.substring(1);
      // pop until we match closingName or empty
      while (stack.length > 0) {
        const popped = stack.pop();
        if (popped === closingName) break;
      }
    } else if (!isSelfClosing(match[0], code, match.index)) {
      stack.push(tagName);
    }
  }
  
  return stack.pop() || null;
}

function isSelfClosing(tagStr, fullCode, index) {
  if (tagStr.endsWith('/>')) return true;
  // Let's find the closing '>' of this tag
  const sub = fullCode.substring(index);
  const closingIdx = sub.indexOf('>');
  if (closingIdx === -1) return false;
  const tagContent = sub.substring(0, closingIdx + 1);
  return tagContent.endsWith('/>');
}

function isTextTag(tagName) {
  const allowed = ['Text', 'TextInput', 'option', 'Button', 'FormattedMessage'];
  return allowed.includes(tagName) || tagName.endsWith('Text') || tagName.endsWith('Input');
}

function getLineNumber(code, index) {
  return code.substring(0, index).split('\n').length;
}

console.log('JSX validation completed.');
