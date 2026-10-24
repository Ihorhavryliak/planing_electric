import { getErrorMessage } from '@/lib/api';

export type PlanUploadKind = 'pdf' | 'image';

export function planUploadKind(file: File): PlanUploadKind | null {
  const fileName = file.name.toLowerCase();

  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    /\.(png|jpe?g)$/.test(fileName)
  ) {
    return 'image';
  }

  return null;
}

export function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return getErrorMessage(error);
}
