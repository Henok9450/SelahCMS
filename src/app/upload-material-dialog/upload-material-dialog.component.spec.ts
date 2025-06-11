import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadMaterialDialogComponent } from './upload-material-dialog.component';

describe('UploadMaterialDialogComponent', () => {
  let component: UploadMaterialDialogComponent;
  let fixture: ComponentFixture<UploadMaterialDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadMaterialDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadMaterialDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
