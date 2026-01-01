import { initializeAppInsights } from '@/config/appInsights';

/**
 * Composable for telemetry tracking with Azure Application Insights
 */
export function useTelemetry() {
  const insights = initializeAppInsights();
  return {
    /**
     * Track a page view
     */
    trackPageView(name: string, uri?: string) {
      insights?.trackPageView({ name, uri });
    },

    /**
     * Track a custom event
     */
    trackEvent(name: string, properties?: Record<string, any>) {
      insights?.trackEvent({ name, properties });
    },

    /**
     * Track an exception
     */
    trackException(exception: Error, properties?: Record<string, any>) {
      insights?.trackException({ exception, properties });
    },

    /**
     * Track an API call or dependency
     */
    trackDependency(
      name: string,
      data: string,
      duration: number,
      success: boolean,
      resultCode?: number,
    ) {
      insights?.trackDependencyData({
        id: `${name}-${Date.now()}`,
        name,
        data,
        duration,
        success,
        responseCode: resultCode ?? 0,
        type: 'Fetch',
      });
    },

    /**
     * Track a metric
     */
    trackMetric(name: string, value: number, properties?: Record<string, any>) {
      insights?.trackMetric({ name, average: value }, properties);
    },
  };
}