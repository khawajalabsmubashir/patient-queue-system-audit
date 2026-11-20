export function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  const msg = error.message || "";
  if (
    error.name === "TypeError" ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(msg)
  ) {
    return "Connection failed. Please check your internet connection and try again.";
  }
  return msg || "Something went wrong. Please try again.";
}
