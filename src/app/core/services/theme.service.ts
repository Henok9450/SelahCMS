import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'selah_theme_preference';
  
  // Active theme signal ('dark' or 'light')
  currentTheme = signal<AppTheme>(this.getInitialTheme());

  constructor() {
    // Apply initial theme immediately synchronously
    this.applyTheme(this.currentTheme());

    // Apply theme whenever signal changes
    effect(() => {
      this.applyTheme(this.currentTheme());
    });

    // Listen for OS theme changes if user hasn't explicitly set preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(this.THEME_STORAGE_KEY)) {
          this.currentTheme.set(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  /**
   * Toggle between dark and light themes
   */
  toggleTheme(): void {
    const nextTheme: AppTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  /**
   * Set specific theme
   */
  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    this.applyTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.THEME_STORAGE_KEY, theme);
    }
  }

  /**
   * Check if current active theme is dark
   */
  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }

  private getInitialTheme(): AppTheme {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(this.THEME_STORAGE_KEY) as AppTheme | null;
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Default to light theme
    return 'light';
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);

    if (theme === 'light') {
      root.classList.remove('dark-theme');
      root.classList.add('light-theme');
      body.classList.remove('dark-theme');
      body.classList.add('light-theme');
    } else {
      root.classList.remove('light-theme');
      root.classList.add('dark-theme');
      body.classList.remove('light-theme');
      body.classList.add('dark-theme');
    }
  }
}
