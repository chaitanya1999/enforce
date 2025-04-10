import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryOutputTableComponent } from './query-output-table.component';

describe('QueryOutputTableComponent', () => {
  let component: QueryOutputTableComponent;
  let fixture: ComponentFixture<QueryOutputTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryOutputTableComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QueryOutputTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
