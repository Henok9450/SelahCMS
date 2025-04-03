import { TestBed } from '@angular/core/testing';

import { HiyawMahiderService } from './hiyaw-mahider.service';

describe('HiyawMahiderService', () => {
  let service: HiyawMahiderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HiyawMahiderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
