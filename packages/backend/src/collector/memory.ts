import path from 'node:path';
import fs from 'node:fs';
import chokidar from 'chokidar';
import type { DbQueries } from '../db/queries.js';

type Severity = 'low' | 'medium' | 'high';
interface FlagReason {
  severity: Severity;
  heuristic: string;
  detail: string;
}

const detectFlags = (filePath: string, content: string): FlagReason[] => {
  const flags: FlagReason[] = [];
  const lines = content.split(/\r?\n/);

  const sentenceCounts = new Map<string, number>();
  for (const sentence of content.split(/[.!?]\s+/).map((s) => s.trim()).filter(Boolean)) {
    sentenceCounts.set(sentence, (sentenceCounts.get(sentence) ?? 0) + 1);
  }
  for (const [sentence, count] of sentenceCounts.entries()) {
    if (count >= 3 && sentence.length > 8) {
      flags.push({ severity: 'high', heuristic: 'duplicate_content', detail: `Repeated ${count} times: ${sentence.slice(0, 80)}` });
      break;
    }
  }

  const fenceCount = (content.match(/```/g) ?? []).length;
  if (fenceCount % 2 !== 0) {
    flags.push({ severity: 'medium', heuristic: 'broken_markdown', detail: 'Unclosed code block fence detected.' });
  }

  const malformedHeaders = lines.filter((line) => /^#+[^\s#]/.test(line));
  if (malformedHeaders.length > 0) {
    flags.push({ severity: 'medium', heuristic: 'broken_markdown', detail: `Malformed headers: ${malformedHeaders.slice(0, 2).join(', ')}` });
  }

  const factMap = new Map<string, Set<string>>();
  const factRegex = /^([A-Z][A-Za-z0-9_\- ]{1,50}) is ([^.;]+)$/gm;
  let factMatch = factRegex.exec(content);
  while (factMatch) {
    const subject = factMatch[1].trim();
    const predicate = factMatch[2].trim();
    if (!factMap.has(subject)) factMap.set(subject, new Set());
    factMap.get(subject)?.add(predicate);
    factMatch = factRegex.exec(content);
  }
  for (const [subject, predicates] of factMap.entries()) {
    if (predicates.size > 1) {
      flags.push({ severity: 'high', heuristic: 'inconsistent_facts', detail: `${subject} has conflicting facts: ${[...predicates].join(' | ')}` });
      break;
    }
  }

  if (path.basename(filePath) === 'MEMORY.md' && lines.length > 200) {
    flags.push({ severity: 'high', heuristic: 'oversized_memory', detail: `MEMORY.md has ${lines.length} lines (recommended <= 200).` });
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (/^#{1,6}\s+/.test(lines[i])) {
      const nextLine = lines[i + 1] ?? '';
      if (!nextLine.trim() || /^#{1,6}\s+/.test(nextLine)) {
        flags.push({ severity: 'low', heuristic: 'empty_section', detail: `Header appears empty: ${lines[i]}` });
      }
    }
  }

  return flags;
};

export const startMemoryWatcher = (memoryDir: string, db: DbQueries): void => {
  const patterns = [
    path.join(memoryDir, 'MEMORY.md'),
    path.join(memoryDir, '*.md'),
    path.join(memoryDir, '**/*.md')
  ];

  const capture = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const flags = detectFlags(filePath, content);
    db.insertMemorySnapshot({
      captured_at: Date.now(),
      file_path: filePath,
      content,
      word_count: content.split(/\s+/).filter(Boolean).length,
      flagged: flags.length ? 1 : 0,
      flag_reason: flags.length ? JSON.stringify(flags) : null
    });
  };

  const watcher = chokidar.watch(patterns, { ignoreInitial: false });
  watcher.on('add', capture);
  watcher.on('change', capture);
};

export const startLogWatcher = (logDir: string, onLine: (line: string) => void): void => {
  const watcher = chokidar.watch(path.join(logDir, '**/*.log'), { ignoreInitial: false });
  const offsets = new Map<string, number>();

  const scan = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const prev = offsets.get(filePath) ?? 0;
    const size = fs.statSync(filePath).size;
    const start = Math.min(prev, size);
    const stream = fs.createReadStream(filePath, { start, end: size });
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
    });
    stream.on('end', () => {
      offsets.set(filePath, size);
      buf.split(/\r?\n/).filter(Boolean).forEach(onLine);
    });
  };

  watcher.on('add', scan);
  watcher.on('change', scan);
};
