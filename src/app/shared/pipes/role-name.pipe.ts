import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../../core/services/translation.service';

/**
 * Standard Amharic mapping for Church / System roles
 */
export const ROLE_TRANSLATIONS: Record<string, { en: string; am: string }> = {
  'Admin': {
    en: 'Admin',
    am: 'አስተዳዳሪ'
  },
  'Administrator': {
    en: 'Administrator',
    am: 'አስተዳዳሪ'
  },
  'Pastor': {
    en: 'Pastor',
    am: 'ፓስተር'
  },
  'Deputy Pastor': {
    en: 'Deputy Pastor',
    am: 'ምክትል ፓስተር'
  },
  'Zone Coordinator': {
    en: 'Zone Coordinator',
    am: 'የዞን አስተባባሪ'
  },
  'Member': {
    en: 'Member',
    am: 'አባል'
  },
  'Fellowship Leader': {
    en: 'Fellowship Leader',
    am: 'የሕብረት መሪ'
  },
  'Guest': {
    en: 'Guest',
    am: 'እንግዳ'
  }
};

@Pipe({
  name: 'appRoleName',
  standalone: true,
  pure: false // Pure false to re-evaluate when language changes
})
export class RoleNamePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(role: string | null | undefined): string {
    if (!role) return '';

    const lang = this.translationService.currentLang;
    const cleanRole = role.trim();

    // Check case-insensitive match in dictionary
    const matchKey = Object.keys(ROLE_TRANSLATIONS).find(
      k => k.toLowerCase() === cleanRole.toLowerCase()
    );

    if (matchKey) {
      return lang === 'am' ? ROLE_TRANSLATIONS[matchKey].am : ROLE_TRANSLATIONS[matchKey].en;
    }

    return cleanRole;
  }
}
