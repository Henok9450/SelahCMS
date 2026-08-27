import { TestBed } from '@angular/core/testing';

import { LearningProgressService } from './learning-progress.service';

describe('LearningProgressService', () => {
  let service: LearningProgressService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearningProgressService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
