import { diffLines, Change } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function computeResumeDiff(base: string, tailored: string): DiffLine[] {
  const changes: Change[] = diffLines(base, tailored);
  const result: DiffLine[] = [];
  for (const change of changes) {
    const lines = change.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l);
    for (const line of lines) {
      if (change.added) result.push({ type: 'added', value: line });
      else if (change.removed) result.push({ type: 'removed', value: line });
      else result.push({ type: 'unchanged', value: line });
    }
  }
  return result;
}
