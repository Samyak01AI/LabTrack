export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const request = { ...options, credentials: 'include', headers };
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    request.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, request);
  if (response.status === 204) {
    if (!response.ok) throw new ApiError('Request failed.', response.status);
    return null;
  }
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.error
      ? payload.error
      : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}
