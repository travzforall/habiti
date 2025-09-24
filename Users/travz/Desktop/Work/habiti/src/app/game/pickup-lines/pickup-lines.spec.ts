import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PickupLines } from './pickup-lines';

describe('PickupLines', () => {
  let component: PickupLines;
  let fixture: ComponentFixture<PickupLines>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PickupLines]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PickupLines);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
