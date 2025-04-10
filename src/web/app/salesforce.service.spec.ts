import { TestBed } from '@angular/core/testing';

import { SalesforceServiceService } from './salesforce.service';

describe('SalesforceServiceService', () => {
  let service: SalesforceServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesforceServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
