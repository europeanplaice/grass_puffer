export async function shareApp(): Promise<'shared' | 'copied'> {
  const data = {
    title: 'Grass Puffer Diary',
    text: 'Google Drive で管理するプライベート日記アプリ',
    url: window.location.origin,
  };
  if (navigator.share && navigator.canShare?.(data)) {
    await navigator.share(data);
    return 'shared';
  }
  await navigator.clipboard.writeText(window.location.origin);
  return 'copied';
}

export async function shareEntry(_date: string, content: string, label: string): Promise<'shared' | 'copied'> {
  const data = { title: `Diary – ${label}`, text: content };
  if (navigator.share && navigator.canShare?.(data)) {
    await navigator.share(data);
    return 'shared';
  }
  await navigator.clipboard.writeText(content);
  return 'copied';
}
