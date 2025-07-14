import * as Sentry from "@sentry/react";

export const initSentry = (dsn: string) => {
  Sentry.init({
    dsn: dsn,
  });
};
