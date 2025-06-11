import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserManagementReportComponent } from './user-management-report.component';

describe('UserManagementReportComponent', () => {
  let component: UserManagementReportComponent;
  let fixture: ComponentFixture<UserManagementReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserManagementReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserManagementReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
