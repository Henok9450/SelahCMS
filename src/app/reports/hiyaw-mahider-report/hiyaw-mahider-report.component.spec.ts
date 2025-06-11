import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HiyawMahiderReportComponent } from './hiyaw-mahider-report.component';

describe('HiyawMahiderReportComponent', () => {
  let component: HiyawMahiderReportComponent;
  let fixture: ComponentFixture<HiyawMahiderReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HiyawMahiderReportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HiyawMahiderReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
