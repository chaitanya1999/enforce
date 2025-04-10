import { TestBed } from '@angular/core/testing';

import { EditorConfigService } from './editor-config.service';

describe('EditorConfigService', () => {
  let service: EditorConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
