import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudyMaterialsComponent } from './study-materials.component';

describe('StudyMaterialsComponent', () => {
  let component: StudyMaterialsComponent;
  let fixture: ComponentFixture<StudyMaterialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudyMaterialsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudyMaterialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
