export function avatarColorClass(seed: string | number): string {
  const palette = [
    'bg-emerald-600',
    'bg-sky-600',
    'bg-violet-600',
    'bg-rose-600',
    'bg-amber-700',
    'bg-teal-600',
    'bg-indigo-600',
    'bg-fuchsia-600',
  ];

  let hash = 0;
  if (typeof seed === 'number') {
    hash = seed;
  } else {
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
  }

  // Ensure positive index
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}
