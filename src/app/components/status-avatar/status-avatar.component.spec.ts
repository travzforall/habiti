import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { StatusAvatarComponent } from './status-avatar.component';
import { StatusService } from '../../services/status.service';
import { UserStatus } from '../../utils/status-derivation.util';

class MockStatusService {
  snapshot = signal({
    status: 'sleeping' as UserStatus,
    intensity: 0.15,
    reason: 'Resting up.',
    source: 'derived' as const,
    since: new Date(),
    label: 'Sleeping',
    emoji: '😴',
    color: '#6366f1'
  });
  manualOverride = signal<UserStatus | null>(null);
  displayMode = signal<'character' | 'photo'>('character');
  setStatus = jasmine.createSpy('setStatus');
  clearStatus = jasmine.createSpy('clearStatus');
  setDisplayMode = jasmine
    .createSpy('setDisplayMode')
    .and.callFake((m: 'character' | 'photo') => this.displayMode.set(m));
}

describe('StatusAvatarComponent', () => {
  let fixture: ComponentFixture<StatusAvatarComponent>;
  let statusService: MockStatusService;

  beforeEach(async () => {
    statusService = new MockStatusService();
    await TestBed.configureTestingModule({
      imports: [StatusAvatarComponent],
      providers: [provideHttpClient(), { provide: StatusService, useValue: statusService }]
    }).compileComponents();

    fixture = TestBed.createComponent(StatusAvatarComponent);
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('fills the whole circle with the status face rather than a corner badge', () => {
    fixture.componentRef.setInput('name', 'Testing User');
    fixture.detectChanges();

    const face = el().querySelector('.status-face') as HTMLElement;
    expect(face).withContext('status face should render').toBeTruthy();
    expect(face.textContent?.trim()).toBe('😴');

    // The face is a large share of the avatar, not a ~30% pill in the corner.
    const avatar = el().querySelector('.status-avatar') as HTMLElement;
    const avatarPx = parseFloat(avatar.style.width);
    const facePx = parseFloat(face.style.fontSize);
    expect(facePx / avatarPx).toBeGreaterThan(0.5);

    // The old badge element is gone for good.
    expect(el().querySelector('.status-badge')).toBeNull();
  });

  it('shows no photo at all in character mode', () => {
    fixture.componentRef.setInput('photoUrl', 'https://example.com/a.jpg');
    fixture.componentRef.setInput('name', 'Testing User');
    fixture.detectChanges();

    expect(el().querySelector('.status-face')).toBeTruthy();
    expect(el().querySelector('img'))
      .withContext('character mode must not render the profile photo')
      .toBeNull();
  });

  it('shows the photo and no character in photo mode', () => {
    statusService.displayMode.set('photo');
    fixture.componentRef.setInput('photoUrl', 'https://example.com/a.jpg');
    fixture.componentRef.setInput('name', 'Testing User');
    fixture.detectChanges();

    expect((el().querySelector('img') as HTMLImageElement)?.src).toContain('a.jpg');
    expect(el().querySelector('.status-face'))
      .withContext('photo mode must not overlay the character')
      .toBeNull();
  });

  it('falls back to the initial in photo mode when there is no photo', () => {
    statusService.displayMode.set('photo');
    fixture.componentRef.setInput('name', 'Testing User');
    fixture.detectChanges();

    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('.status-avatar')?.textContent?.trim()).toBe('T');
  });

  it('honours an explicit displayMode input over the user preference', () => {
    statusService.displayMode.set('character');
    fixture.componentRef.setInput('displayMode', 'photo');
    fixture.componentRef.setInput('photoUrl', 'https://example.com/a.jpg');
    fixture.detectChanges();

    expect(el().querySelector('img')).toBeTruthy();
    expect(el().querySelector('.status-face')).toBeNull();
  });

  it('tags the container with the status so CSS can drive the animation', () => {
    fixture.detectChanges();
    expect(el().querySelector('.status-avatar')?.getAttribute('data-status')).toBe('sleeping');

    statusService.snapshot.update(s => ({ ...s, status: 'thriving' as UserStatus, emoji: '🕺' }));
    fixture.detectChanges();
    expect(el().querySelector('.status-avatar')?.getAttribute('data-status')).toBe('thriving');
  });

  describe('status picker', () => {
    it('stays closed and non-interactive by default', () => {
      fixture.detectChanges();
      (el().querySelector('.status-avatar') as HTMLElement).click();
      fixture.detectChanges();

      expect(el().querySelector('.status-picker')).toBeNull();
      expect(el().querySelector('.status-avatar')?.getAttribute('role')).toBe('img');
    });

    it('opens on click when interactive and sets the chosen status', () => {
      fixture.componentRef.setInput('interactive', true);
      fixture.detectChanges();

      const avatar = el().querySelector('.status-avatar') as HTMLElement;
      expect(avatar.getAttribute('role')).toBe('button');

      avatar.click();
      fixture.detectChanges();
      expect(el().querySelector('.status-picker')).toBeTruthy();

      const buttons = Array.from(el().querySelectorAll('.status-picker button'));
      const focused = buttons.find(b => b.textContent?.includes('Focused')) as HTMLElement;
      focused.click();
      fixture.detectChanges();

      expect(statusService.setStatus).toHaveBeenCalledWith('focused');
      expect(el().querySelector('.status-picker')).withContext('closes after choosing').toBeNull();
    });

    it('clears the override via Automatic', () => {
      fixture.componentRef.setInput('interactive', true);
      fixture.detectChanges();
      (el().querySelector('.status-avatar') as HTMLElement).click();
      fixture.detectChanges();

      const auto = Array.from(el().querySelectorAll('.status-picker button')).find(b =>
        b.textContent?.includes('Automatic')
      ) as HTMLElement;
      auto.click();
      fixture.detectChanges();

      expect(statusService.clearStatus).toHaveBeenCalled();
    });

    it('switches between character and photo, and stays open while doing so', () => {
      fixture.componentRef.setInput('interactive', true);
      fixture.componentRef.setInput('photoUrl', 'https://example.com/a.jpg');
      fixture.detectChanges();
      (el().querySelector('.status-avatar') as HTMLElement).click();
      fixture.detectChanges();

      const photoBtn = Array.from(el().querySelectorAll('.status-picker button')).find(
        b => b.textContent?.trim() === 'Photo'
      ) as HTMLElement;
      photoBtn.click();
      fixture.detectChanges();

      expect(statusService.setDisplayMode).toHaveBeenCalledWith('photo');
      expect(el().querySelector('.status-picker'))
        .withContext('stays open so the change is visible')
        .toBeTruthy();
      expect(el().querySelector('img')).toBeTruthy();
      expect(el().querySelector('.status-face')).toBeNull();
    });

    it('closes on an outside click', () => {
      fixture.componentRef.setInput('interactive', true);
      fixture.detectChanges();
      (el().querySelector('.status-avatar') as HTMLElement).click();
      fixture.detectChanges();
      expect(el().querySelector('.status-picker')).toBeTruthy();

      document.body.click();
      fixture.detectChanges();
      expect(el().querySelector('.status-picker')).toBeNull();
    });
  });
});
