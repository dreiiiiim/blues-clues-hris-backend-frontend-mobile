type EnvValue = string | undefined;
type EnvMap = Record<string, EnvValue>;

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);

function parsePort(raw?: string): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function hasDefaultSupabase(env: EnvMap): boolean {
  return Boolean(
    env.SUPABASE_URL &&
      env.SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function hasScopedSupabase(env: EnvMap): boolean {
  const entries = Object.entries(env);
  return entries.some(([key, value]) => {
    if (!key.endsWith('_SUPABASE_URL') || !value) return false;
    const prefix = key.slice(0, -'_SUPABASE_URL'.length);
    return Boolean(env[`${prefix}_SUPABASE_SECRET_KEY`]);
  });
}

function throwMissing(name: string): never {
  throw new Error(
    `[env] Missing required environment variable: ${name}. Set it in .env or deployment secrets.`,
  );
}

export function validateEnv(input: EnvMap): EnvMap {
  const env: EnvMap = { ...input };
  const nodeEnv = env.NODE_ENV ?? 'development';

  if (!VALID_NODE_ENVS.has(nodeEnv)) {
    throw new Error(
      `[env] NODE_ENV must be one of: development, test, production. Received: ${nodeEnv}`,
    );
  }

  const parsedPort = parsePort(env.PORT);
  if (!parsedPort) {
    throw new Error('[env] PORT must be an integer between 1 and 65535.');
  }
  env.PORT = String(parsedPort);

  if (nodeEnv !== 'production') {
    return env;
  }

  if (!env.ALLOWED_ORIGINS) {
    throwMissing('ALLOWED_ORIGINS');
  }

  if (!env.API_CENTER_BASE_URL) {
    throwMissing('API_CENTER_BASE_URL');
  }

  const hasTribeCreds = Boolean(env.API_CENTER_TRIBE_ID && env.API_CENTER_TRIBE_SECRET);
  const hasLegacyKey = Boolean(env.API_CENTER_API_KEY);
  if (!hasTribeCreds && !hasLegacyKey) {
    throw new Error(
      '[env] Provide APICenter tribe credentials (API_CENTER_TRIBE_ID + API_CENTER_TRIBE_SECRET) or API_CENTER_API_KEY.',
    );
  }

  if (!hasDefaultSupabase(env) && !hasScopedSupabase(env)) {
    throw new Error(
      '[env] Provide either default Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) or at least one scoped pair (<SERVICE>_SUPABASE_URL + <SERVICE>_SUPABASE_SECRET_KEY).',
    );
  }

  return env;
}
