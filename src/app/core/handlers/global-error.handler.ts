import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const message = error?.message || error?.toString?.() || '';

    // Check for chunk / module loading errors that occur after new production deployments
    const isChunkError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('Failed to load module script');

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();

      // Only auto-reload if not already reloaded in the last 15 seconds (prevents infinite loop)
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('last_chunk_reload', now.toString());
        console.warn('New deployment detected. Automatically refreshing application to load new assets...');
        window.location.reload();
        return;
      }
    }

    console.error('Application Error:', error);
  }
}
