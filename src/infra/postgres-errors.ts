const POSTGRES_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  const cause = err instanceof Error ? err.cause : undefined;

  return (
    !!cause &&
    typeof cause === "object" &&
    "code" in cause &&
    cause.code === POSTGRES_UNIQUE_VIOLATION
  );
}
