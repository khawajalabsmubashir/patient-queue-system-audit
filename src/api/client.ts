export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort);
  if (options.signal?.aborted) abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-QueueCare-Request": "1" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const rawText = await response.text();
    let result: {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
    } | null = null;
    try {
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      result = null;
    }
    if (!response.ok || !result?.success) {
      if (response.status === 401 && !path.startsWith("/auth/"))
        window.dispatchEvent(new Event("queuecare:session-expired"));
      throw new ApiError(
        result?.error?.message ??
          (response.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "Unable to complete this request."),
        result?.error?.code ?? "REQUEST_FAILED",
        response.status,
      );
    }
    if (typeof window !== "undefined" && (options.method ?? "GET").toUpperCase() !== "GET") {
      window.dispatchEvent(new Event("queuecare:invalidate-cache"));
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new Error("Connection failed. Please check your internet connection and try again.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
