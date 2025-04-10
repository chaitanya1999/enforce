import { TestBed } from '@angular/core/testing';

import { GlobalEventsService } from './global-events.service';

describe('GlobalEventsService', () => {
  let service: GlobalEventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GlobalEventsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
