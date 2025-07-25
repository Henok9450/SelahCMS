import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { AppRole } from '../core/role.utils';

@Directive({
  selector: '[hasRole]'
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