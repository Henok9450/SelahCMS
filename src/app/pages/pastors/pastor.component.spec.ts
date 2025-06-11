import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PastorComponent } from './pastor.component';

describe('PastorsComponent', () => {
  let component: PastorComponent;
  let fixture: ComponentFixture<PastorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PastorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PastorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
