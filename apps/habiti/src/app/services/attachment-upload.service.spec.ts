import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AttachmentUploadService, MAX_BYTES, formatBytes } from './attachment-upload.service';
import { environment } from '../../environments/environment';

/**
 * The upload path, and specifically the checks that happen BEFORE any bytes
 * move. Being told a 90 MB video is too big after it has finished uploading
 * over mobile data is the failure this is guarding against.
 */

function fileOf(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  // File.size is read-only; a fake size is the only way to test the limits
  // without allocating 100 MB in a browser test.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('AttachmentUploadService', () => {
  let service: AttachmentUploadService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AttachmentUploadService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AttachmentUploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('kindOf', () => {
    it('reads the kind off the MIME type', () => {
      expect(service.kindOf(fileOf('a.jpg', 'image/jpeg', 10))).toBe('image');
      expect(service.kindOf(fileOf('a.mp4', 'video/mp4', 10))).toBe('video');
      expect(service.kindOf(fileOf('a.pdf', 'application/pdf', 10))).toBe('document');
    });
  });

  describe('rejectionReason', () => {
    it('accepts an ordinary photo', () => {
      expect(service.rejectionReason(fileOf('photo.jpg', 'image/jpeg', 3_000_000))).toBeNull();
    });

    it('refuses a type that is not on the allow-list, by name', () => {
      const reason = service.rejectionReason(fileOf('run.exe', 'application/x-msdownload', 100));
      expect(reason).toContain('run.exe');
    });

    it('refuses an unknown type rather than letting it through', () => {
      expect(service.rejectionReason(fileOf('mystery', '', 100))).not.toBeNull();
    });

    it('refuses an oversized video and says what the limit is', () => {
      const reason = service.rejectionReason(fileOf('clip.mp4', 'video/mp4', MAX_BYTES.video + 1));
      expect(reason).toContain('clip.mp4');
      expect(reason).toContain('100');
    });

    it('applies a different limit per kind', () => {
      const size = MAX_BYTES.image + 1;
      expect(service.rejectionReason(fileOf('big.jpg', 'image/jpeg', size))).not.toBeNull();
      expect(service.rejectionReason(fileOf('fine.mp4', 'video/mp4', size))).toBeNull();
    });
  });

  describe('upload', () => {
    it('refuses without making a request at all', done => {
      service.upload(fileOf('run.exe', 'application/x-msdownload', 10)).subscribe({
        error: (error: Error) => {
          expect(error.message).toContain('run.exe');
          // http.verify() in afterEach is what proves no request was made.
          done();
        }
      });
    });

    it('posts multipart to the file endpoint and maps the response', done => {
      // A non-image, so the canvas downscale path is not involved.
      const file = fileOf('notes.txt', 'text/plain', 20);

      service.upload(file).subscribe(progress => {
        if (progress.state !== 'done') return;
        expect(progress.file?.url).toBe('https://db.example/media/user_files/abc.txt');
        expect(progress.file?.name).toBe('abc.txt');
        expect(progress.file?.originalName).toBe('notes.txt');
        expect(progress.file?.size).toBe(20);
        done();
      });

      // The request is made after an async prepare(), so wait a tick for it.
      setTimeout(() => {
        const request = http.expectOne(environment.baserow.filesUrl);
        expect(request.request.method).toBe('POST');
        expect(request.request.body instanceof FormData).toBe(true);
        expect(request.request.headers.get('Authorization')).toContain('Token ');
        // The browser sets the multipart boundary; setting Content-Type breaks it.
        expect(request.request.headers.get('Content-Type')).toBeNull();

        request.flush({
          url: 'https://db.example/media/user_files/abc.txt',
          name: 'abc.txt',
          original_name: 'notes.txt',
          size: 20,
          mime_type: 'text/plain',
          is_image: false,
          image_width: null,
          image_height: null,
          thumbnails: null
        });
      }, 0);
    });

    it('takes the small thumbnail for an image', done => {
      const file = fileOf('shot.png', 'image/png', 1000);

      service.upload(file).subscribe(progress => {
        if (progress.state !== 'done') return;
        expect(progress.file?.thumbnailUrl).toBe('https://db.example/thumb/small.png');
        expect(progress.file?.width).toBe(800);
        done();
      });

      setTimeout(() => {
        const request = http.expectOne(environment.baserow.filesUrl);
        request.flush({
          url: 'https://db.example/media/user_files/shot.png',
          name: 'shot.png',
          original_name: 'shot.png',
          size: 1000,
          mime_type: 'image/png',
          is_image: true,
          image_width: 800,
          image_height: 600,
          thumbnails: { small: { url: 'https://db.example/thumb/small.png' } }
        });
      }, 50);
    });
  });
});

describe('formatBytes', () => {
  it('reads like a person wrote it', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB');
  });
});
