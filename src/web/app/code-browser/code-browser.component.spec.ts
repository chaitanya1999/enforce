import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeBrowserComponent } from './code-browser.component';

describe('CodeBrowserComponent', () => {
  let component: CodeBrowserComponent;
  let fixture: ComponentFixture<CodeBrowserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeBrowserComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CodeBrowserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
