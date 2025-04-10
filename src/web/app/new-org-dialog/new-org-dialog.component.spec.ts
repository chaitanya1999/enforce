import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewOrgDialogComponent } from './new-org-dialog.component';

describe('NewOrgDialogComponent', () => {
  let component: NewOrgDialogComponent;
  let fixture: ComponentFixture<NewOrgDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewOrgDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NewOrgDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
