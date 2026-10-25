const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: unknown };

    if (typeof body.message === 'string') {
      message = body.message;
    } else if (Array.isArray(body.message)) {
      message = body.message
        .filter((item): item is string => typeof item === 'string')
        .join(' ');
    }
  } catch {
    // Keep the fallback message when the response has no JSON body.
  }

  return new ApiError(response.status, message);
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  let response: Response;

  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      0,
      'Unable to reach the API. Make sure it is running and try again.',
    );
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return response;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await apiFetch(path, { ...init, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}
