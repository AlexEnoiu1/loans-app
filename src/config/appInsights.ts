import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { appConfig } from '@/config/appConfig';
let appInsights: ApplicationInsights | null = null;

/**
 * Initialize Application Insights if connection string is configured
 */
export function initializeAppInsights(): ApplicationInsights | null {
  if (appInsights) {
    return appInsights;
  }

  if (!appConfig.appInsightsConnectionString) {
    console.warn('App Insights connection string not configured');
    return null;
  }

  appInsights = new ApplicationInsights({
    config: {
      connectionString: appConfig.appInsightsConnectionString,
      enableAutoRouteTracking: true, // Automatically track route changes
      disableFetchTracking: false, // Track fetch requests
      enableCorsCorrelation: true, // Enable CORS correlation
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
    },
  });

  appInsights.loadAppInsights();
  console.log('App Insights initialized');

  return appInsights;
}
