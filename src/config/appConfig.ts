export interface AppConfig {
  apiBaseUrl: string;
  auth0: {
    domain: string;
    clientId: string;
    audience?: string;
  };
}

export function loadAppConfig(): AppConfig {
  const apiBaseUrl =
    (import.meta.env.VITE_API_BASE_URL as string) ??
    'http://localhost:7071/api/';
  const domain = (import.meta.env.VITE_AUTH0_DOMAIN as string) ?? '';
  const clientId = (import.meta.env.VITE_AUTH0_CLIENT_ID as string) ?? '';
  const audience =
    (import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined) || undefined;

  return {
    apiBaseUrl,
    auth0: { domain, clientId, audience },
  };
}

export const appConfig = loadAppConfig();

export function buildAuth0Options(cfg: AppConfig) {
  return {
    domain: cfg.auth0.domain,
    clientId: cfg.auth0.clientId,
    authorizationParams: {
      redirect_uri: window.location.origin,
      audience: cfg.auth0.audience,
      scope: 'openid profile email read:devices',
    },
    cacheLocation: 'localstorage' as const,
    useRefreshTokens: true,
  };
}
