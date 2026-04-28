export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.message },
    };
  }

  console.error(error);

  return {
    statusCode: 500,
    body: { error: "Something went wrong on the server." },
  };
}
