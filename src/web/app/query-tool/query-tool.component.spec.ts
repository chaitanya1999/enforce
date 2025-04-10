import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryToolComponent } from './query-tool.component';

describe('QueryToolComponent', () => {
  let component: QueryToolComponent;
  let fixture: ComponentFixture<QueryToolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryToolComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QueryToolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
