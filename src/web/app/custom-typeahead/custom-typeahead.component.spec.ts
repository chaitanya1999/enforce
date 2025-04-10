import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomTypeaheadComponent } from './custom-typeahead.component';

describe('CustomTypeaheadComponent', () => {
  let component: CustomTypeaheadComponent;
  let fixture: ComponentFixture<CustomTypeaheadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomTypeaheadComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CustomTypeaheadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
