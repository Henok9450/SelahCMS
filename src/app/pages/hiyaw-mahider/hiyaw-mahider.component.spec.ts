import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HiyawMahiderComponent } from './hiyaw-mahider.component';

describe('HiyawMahiderComponent', () => {
  let component: HiyawMahiderComponent;
  let fixture: ComponentFixture<HiyawMahiderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HiyawMahiderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HiyawMahiderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
