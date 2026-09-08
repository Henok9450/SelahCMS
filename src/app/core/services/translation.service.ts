import { Injectable, inject, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';

export type SupportedLanguage = 'en' | 'am';

declare global {
  interface Window {
    googleTranslateInitCallback?: () => void;
    google?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly STORAGE_KEY = 'selah_app_lang';
  private router = inject(Router);
  private ngZone = inject(NgZone);

  private currentLangSubject = new BehaviorSubject<SupportedLanguage>(this.getInitialLanguage());
  currentLang$ = this.currentLangSubject.asObservable();

  get currentLang(): SupportedLanguage {
    return this.currentLangSubject.value;
  }

  constructor() {
    this.initGoogleTranslate();
    this.listenToRouteChanges();
  }

  private getInitialLanguage(): SupportedLanguage {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === 'am' || saved === 'en') {
      return saved;
    }
    // Check if browser cookie already has translation set
    const cookieMatch = document.cookie.match(/googtrans=\/en\/(am|en)/);
    if (cookieMatch && (cookieMatch[1] === 'am' || cookieMatch[1] === 'en')) {
      return cookieMatch[1] as SupportedLanguage;
    }
    return 'en';
  }

  /**
   * Initializes the Google Translate Element script and registers callback
   */
  private initGoogleTranslate(): void {
    if (typeof window === 'undefined') return;

    // Apply font styling for initial language right away
    this.updateBodyFontClass(this.currentLang);

    // Make sure cookies match current preference
    if (this.currentLang === 'am') {
      this.setGoogleTranslateCookies('am');
    }

    window.googleTranslateInitCallback = () => {
      this.ngZone.run(() => {
        try {
          if (window.google?.translate?.TranslateElement) {
            new window.google.translate.TranslateElement({
              pageLanguage: 'en',
              includedLanguages: 'en,am',
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: false
            }, 'google_translate_element');

            // Wait for combo box safely with retry (no reload loop!)
            this.syncDomLanguageWithRetry(this.currentLang, 15);
          }
        } catch (e) {
          console.warn('[TranslationService] Error initializing Google Translate widget:', e);
        }
      });
    };

    // If script isn't already loaded, inject it
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateInitCallback';
      document.head.appendChild(script);
    }
  }

  /**
   * Sets the active language (English or Amharic)
   */
  setLanguage(lang: SupportedLanguage): void {
    if (this.currentLang === lang && this.getCookie('googtrans') === `/en/${lang}`) {
      return;
    }

    this.currentLangSubject.next(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
    this.updateBodyFontClass(lang);

    this.setGoogleTranslateCookies(lang);

    // Attempt to change combo box dynamically; reload once only if widget not ready
    const applied = this.tryApplyToDom(lang);
    if (!applied) {
      window.location.reload();
    }
  }

  /**
   * Toggles between English and Amharic
   */
  toggleLanguage(): void {
    const nextLang = this.currentLang === 'en' ? 'am' : 'en';
    this.setLanguage(nextLang);
  }

  /**
   * Sets the googtrans cookies across domain levels to persist translation
   */
  private setGoogleTranslateCookies(lang: SupportedLanguage): void {
    const value = `/en/${lang}`;
    const domain = window.location.hostname;

    // Set for current path & root
    document.cookie = `googtrans=${value}; path=/;`;
    document.cookie = `googtrans=${value}; path=/; domain=${domain};`;

    // Also set for higher-level domain if applicable
    const parts = domain.split('.');
    if (parts.length > 1) {
      const rootDomain = parts.slice(-2).join('.');
      document.cookie = `googtrans=${value}; path=/; domain=.${rootDomain};`;
    }

    if (lang === 'en') {
      // Clear cookies when resetting to English
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
    }
  }

  /**
   * Attempts to set the Google Translate dropdown value in the DOM
   */
  private tryApplyToDom(lang: SupportedLanguage): boolean {
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (select) {
      select.value = lang;
      select.dispatchEvent(new Event('change'));
      return true;
    }
    return false;
  }

  /**
   * Retries syncing language without ever calling reload
   */
  private syncDomLanguageWithRetry(lang: SupportedLanguage, maxRetries: number): void {
    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      const applied = this.tryApplyToDom(lang);
      if (applied || retries >= maxRetries) {
        clearInterval(interval);
      }
    }, 200);
  }

  private updateBodyFontClass(lang: SupportedLanguage): void {
    if (typeof document !== 'undefined') {
      if (lang === 'am') {
        document.documentElement.lang = 'am';
        document.body.classList.add('lang-amharic');
      } else {
        document.documentElement.lang = 'en';
        document.body.classList.remove('lang-amharic');
      }
    }
  }

  private getCookie(name: string): string | null {
    const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return matches ? decodeURIComponent(matches[1]) : null;
  }

  /**
   * Listens for Angular navigation to re-apply translation if needed and protect icons
   */
  private listenToRouteChanges(): void {
    this.protectIcons();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.protectIcons();
        if (this.currentLang === 'am') {
          setTimeout(() => {
            this.protectIcons();
            const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
            if (select && select.value !== 'am') {
              select.value = 'am';
              select.dispatchEvent(new Event('change'));
            }
          }, 300);
        }
      });
  }

  /**
   * Prevents Google Translate from mutating Material Icons, phone numbers, and entity data
   */
  public protectIcons(): void {
    if (typeof document === 'undefined') return;

    // Protect icons
    const icons = document.querySelectorAll('mat-icon, .mat-icon, .material-icons, .material-icons-outlined');
    icons.forEach(icon => {
      if (!icon.classList.contains('notranslate')) {
        icon.classList.add('notranslate');
        icon.setAttribute('translate', 'no');
      }
    });

    // Protect phones, emails, and contact links
    const contacts = document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], .contact-link, .phone-link, .email-link, .phone-btn, .email-btn, .col-phone, .col-email');
    contacts.forEach(el => {
      if (!el.classList.contains('notranslate')) {
        el.classList.add('notranslate');
        el.setAttribute('translate', 'no');
      }
    });

    // Protect data codes, times, and member names
    const dataEls = document.querySelectorAll('.code-badge, .header-time, .header-date, .study-time, .col-name, .member-name, .member-title, input, textarea');
    dataEls.forEach(el => {
      if (!el.classList.contains('notranslate')) {
        el.classList.add('notranslate');
        el.setAttribute('translate', 'no');
      }
    });
  }
}
