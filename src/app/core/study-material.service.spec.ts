import { TestBed } from '@angular/core/testing';

import { StudyMaterialService } from './study-material.service';

describe('StudyMaterialService', () => {
  let service: StudyMaterialService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StudyMaterialService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
