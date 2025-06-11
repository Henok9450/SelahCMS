import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZoneReportComponent } from './zone-report.component';

describe('ZoneReportComponent', () => {
  let component: ZoneReportComponent;
  let fixture: ComponentFixture<ZoneReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoneReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZoneReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
