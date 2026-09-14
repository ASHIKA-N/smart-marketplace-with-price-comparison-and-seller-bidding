let accessToken: string | undefined;
let refreshPromise: Promise<boolean> | undefined;
export function setAccessToken(token?: string) {
  accessToken = token;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function refresh() {
  if (!refreshPromise)
    refreshPromise = fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        accessToken = data.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = undefined;
      });
  return refreshPromise;
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  if (
    response.status === 401 &&
    retry &&
    !path.startsWith("/auth/") &&
    (await refresh())
  )
    return api<T>(path, options, false);
  const data = await response
    .json()
    .catch(() => ({
      message: "The service is temporarily unavailable. Please try again.",
    }));
  if (!response.ok)
    throw new ApiError(
      data.message || "Something went wrong.",
      response.status,
    );
  return data as T;
}
