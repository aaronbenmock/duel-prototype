// Backup to uploading: hand logs to the phone's share sheet (Save to Files, Mail, AirDrop...)
// as a file, or download it where sharing files isn't supported.
export async function shareJson(name: string, data: unknown): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
