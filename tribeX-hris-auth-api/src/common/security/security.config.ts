import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function corsOptions(allowedOriginsRaw?: string): CorsOptions {
  const allowedOrigins = (allowedOriginsRaw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    exposedHeaders: ['X-Correlation-ID', 'X-Request-Id'],
    maxAge: 86400,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin '${origin}' is not allowed`), false);
    },
  };
}
