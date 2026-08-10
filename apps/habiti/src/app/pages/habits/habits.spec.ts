import { provideTestUserId } from '@habiti/storage/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { HabitsComponent } from './habits';

describe('HabitsComponent', () => {
  let component: HabitsComponent;
  let fixture: ComponentFixture<HabitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HabitsComponent],
      providers: [provideTestUserId(), provideHttpClient(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HabitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
