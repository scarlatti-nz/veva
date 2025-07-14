import * as Sentry from "@sentry/node"

export const initSentry = (dsn) => {
    Sentry.init({
        dsn,
    });
};

