export interface APIErrorPayload {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

export class APIError extends Error {
  code: string;
  fields?: Record<string, string[]>;

  constructor(payload: APIErrorPayload) {
    super(payload.message);
    this.name = 'APIError';
    this.code = payload.code;
    this.fields = payload.fields;
  }

  isValidation(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  isAuth(): boolean {
    return this.code === 'AUTHENTICATION_FAILED';
  }

  fieldError(field: string): string | undefined {
    return this.fields?.[field]?.[0];
  }
}