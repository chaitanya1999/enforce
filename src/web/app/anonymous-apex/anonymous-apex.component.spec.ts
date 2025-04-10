import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnonymousApexComponent } from './anonymous-apex.component';

describe('AnonymousApexComponent', () => {
  let component: AnonymousApexComponent;
  let fixture: ComponentFixture<AnonymousApexComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnonymousApexComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AnonymousApexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
