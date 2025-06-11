import { TestBed } from '@angular/core/testing';

import { PastorService } from './pastor.service';

describe('PastorService', () => {
  let service: PastorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PastorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
