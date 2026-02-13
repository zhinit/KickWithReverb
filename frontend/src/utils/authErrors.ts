interface ValidationErrors {
  username?: string[];
  password?: string[];
  email?: string[];
}

function isValidationErrors(data: unknown): data is ValidationErrors {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const hasArrayOrUndefined = (key: string) =>
    obj[key] === undefined || Array.isArray(obj[key]);
  return (
    hasArrayOrUndefined("username") &&
    hasArrayOrUndefined("password") &&
    hasArrayOrUndefined("email")
  );
}

export function mapAuthError(
  status: number | null,
  errorData: unknown,
  context: "login" | "register"
): string {
  if (status === null) {
    return "Lost in transit. Please try again.";
  }

  if (status >= 500) {
    return `${status}: Something went wrong. Please try again.`;
  }

  if (context === "login") {
    return `${status}: Invalid username or password`;
  }

  if (context === "register" && isValidationErrors(errorData)) {
    const messages: string[] = [];

    if (errorData.username?.length) {
      messages.push("Username is already taken");
    }
    if (errorData.password?.length) {
      messages.push("Password must be at least 8 characters");
    }
    if (errorData.email?.length) {
      messages.push("Please enter a valid email address");
    }

    if (messages.length > 0) {
      return `${status}: ${messages.join(". ")}`;
    }
  }

  return `${status}: Something went wrong. Please try again.`;
}
