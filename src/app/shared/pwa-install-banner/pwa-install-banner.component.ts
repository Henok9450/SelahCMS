import { Component, OnInit, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './pwa-install-banner.component.html',
  styleUrls: ['./pwa-install-banner.component.css']
})
export class PwaInstallBannerComponent implements OnInit {
  private readonly DISMISSED_KEY = 'selah_pwa_dismissed_at';
  private deferredPrompt: any = null;

  showBanner = signal<boolean>(false);
  isInstalled = signal<boolean>(false);

  ngOnInit(): void {
    // Check if app is already running in standalone mode (installed)
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           (window.navigator as any).standalone === true;
      if (isStandalone) {
        this.isInstalled.set(true);
        return;
      }

      // Check if user recently dismissed banner (within 7 days)
      const dismissedAt = localStorage.getItem(this.DISMISSED_KEY);
      if (dismissedAt) {
        const diffDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
        if (diffDays < 7) {
          return;
        }
      }
    }
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    // Prevent default mini-infobar on mobile
    event.preventDefault();
    this.deferredPrompt = event;

    // Only show if not dismissed recently
    const dismissedAt = localStorage.getItem(this.DISMISSED_KEY);
    if (!dismissedAt) {
      this.showBanner.set(true);
    }
  }

  @HostListener('window:appinstalled')
  onAppInstalled(): void {
    this.isInstalled.set(true);
    this.showBanner.set(false);
    this.deferredPrompt = null;
    console.log('[PWA] SelahCMS successfully installed on device.');
  }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) {
      // Fallback instructions if native prompt isn't directly triggerable
      alert('To install SelahCMS on iOS/Safari: tap the Share icon and select "Add to Home Screen". On desktop: click the install icon in your browser address bar.');
      return;
    }

    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] User accepted install prompt');
      this.showBanner.set(false);
    }
    this.deferredPrompt = null;
  }

  dismiss(): void {
    this.showBanner.set(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.DISMISSED_KEY, Date.now().toString());
    }
  }
}
