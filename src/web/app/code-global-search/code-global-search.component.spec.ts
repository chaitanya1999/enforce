import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeGlobalSearchComponent } from './code-global-search.component';

describe('CodeGlobalSearchComponent', () => {
  let component: CodeGlobalSearchComponent;
  let fixture: ComponentFixture<CodeGlobalSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeGlobalSearchComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CodeGlobalSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
