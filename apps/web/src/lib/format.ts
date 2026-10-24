const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}
