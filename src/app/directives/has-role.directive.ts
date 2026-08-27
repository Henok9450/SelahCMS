import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../core/services/auth.service'; // Adjust path as needed
import { AppRole } from '../core/utils/role.utils'; // Import your role type

@Directive({
  selector: '[hasRole]', // Usage: *hasRole="'Admin'"
  standalone: true      // Mark as standalone for Angular 17+
})
export class HasRoleDirective {
  private hasView = false;

  @Input() set hasRole(role: AppRole) {
    this.auth.hasRole(role).subscribe(hasRole => {
      if (hasRole && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!hasRole && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private auth: AuthService
  ) {}
}
