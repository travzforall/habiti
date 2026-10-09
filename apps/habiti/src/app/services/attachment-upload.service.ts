import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Observable, Subscription, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AttachmentKind } from '../models/project.model';
import { ALLOWED_DOCUMENT_TYPES, MAX_BYTES, formatBytes } from '../config/attachment-limits';

// Re-exported so callers that already import from this service keep working.
export { MAX_BYTES, QUOTA_BYTES, formatBytes } from '../config/attachment-limits';

/**
 * Puts a file into Baserow's storage and reports where it landed.
 *
 * ── THE ONE PLACE THAT UPLOADS ────────────────────────────────────────────
 *
 * Every attachment in the app goes through this service, so moving uploads
 * behind a server-side proxy later is a change to THIS FILE and nothing else.
 * That matters more than usual here, because of what is true today:
 *
 *   1. The endpoint accepts the DATABASE TOKEN that ships in the client
 *      bundle. Anyone reading the JS can upload to this instance.
 *   2. What comes back is a PUBLIC URL. Unguessable, but unauthenticated:
 *      `GET` with no headers returns the file. Verified 2026-08-15.
 *   3. Deleting the row that references a file does NOT delete the file. A
 *      database token cannot delete stored files at all, so "remove" means
 *      detach. The UI says that; see AttachmentsService.
 *
 * None of that is a reason to avoid attachments — it is a reason to be plain
 * about them, and to keep the seam in one place.
 */

export interface UploadedFile {
  url: string;
  /** Baserow's opaque stored name — the only handle for a future real delete. */
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface UploadProgress {
  state: 'uploading' | 'done';
  /** 0–100, or undefined when the browser cannot measure it. */
  percent?: number;
  file?: UploadedFile;
}

/** The longest edge an uploaded photo keeps. Beyond this nobody is looking closer. */
const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 0.82;

@Injectable({ providedIn: 'root' })
export class AttachmentUploadService {
  private http = inject(HttpClient);

  private get uploadUrl(): string {
    return environment.baserow.filesUrl;
  }

  private get token(): string {
    return environment.baserow.token;
  }

  /** What this file counts as, decided once so every view agrees. */
  kindOf(file: File): AttachmentKind {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  }

  /**
   * Why this file cannot be attached, or null if it can.
   *
   * Returns a sentence for a human, not a code: it is shown as-is, BEFORE the
   * upload starts. Being told a 90 MB video is too big after waiting for it to
   * upload is the version of this that wastes someone's data allowance.
   */
  rejectionReason(file: File): string | null {
    const kind = this.kindOf(file);

    if (kind === 'document' && !ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return `${file.name} is a type Habiti does not accept (${file.type || 'unknown'}). Documents, images and video only.`;
    }

    // An image is downscaled before it goes anywhere, so the limit applies to
    // what comes off the camera, generously.
    if (file.size > MAX_BYTES[kind]) {
      return `${file.name} is ${formatBytes(file.size)}. The limit for ${kind === 'video' ? 'video' : kind + 's'} is ${formatBytes(MAX_BYTES[kind])}.`;
    }

    return null;
  }

  /**
   * Uploads one file, emitting progress and then the stored result.
   *
   * Images are downscaled first. That keeps phone photos small, and — because
   * a canvas re-encode discards everything that is not pixels — it STRIPS EXIF,
   * GPS coordinates included. That is a real privacy improvement and it applies
   * to images only: video metadata is untouched, and the notice says so.
   */
  upload(file: File): Observable<UploadProgress> {
    const reason = this.rejectionReason(file);
    if (reason) return throwError(() => new Error(reason));

    return new Observable<UploadProgress>(subscriber => {
      let cancelled = false;
      let inFlight: Subscription | null = null;

      this.prepare(file).then(prepared => {
        if (cancelled) return;

        const body = new FormData();
        body.append('file', prepared, prepared.name);

        inFlight = this.http
          .post<BaserowUploadResponse>(this.uploadUrl, body, {
            // No Content-Type: the browser must set the multipart boundary.
            headers: new HttpHeaders({ Authorization: `Token ${this.token}` }),
            observe: 'events',
            reportProgress: true
          })
          .subscribe({
            next: event => {
              if (event.type === HttpEventType.UploadProgress) {
                subscriber.next({
                  state: 'uploading',
                  percent: event.total ? Math.round((event.loaded / event.total) * 100) : undefined
                });
              } else if (event.type === HttpEventType.Response && event.body) {
                subscriber.next({ state: 'done', percent: 100, file: toUploaded(event.body) });
                subscriber.complete();
              }
            },
            error: err => subscriber.error(err)
          });
      });

      // Unsubscribing cancels the request in flight — that is what the
      // uploader's Cancel button does, and it has to actually stop the upload.
      return () => {
        cancelled = true;
        inFlight?.unsubscribe();
      };
    });
  }

  /** Downscales an image; anything else is passed through untouched. */
  private async prepare(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    // GIFs would lose their animation to a canvas, and SVG has no pixels to scale.
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

    try {
      /**
       * `imageOrientation: 'from-image'` is load-bearing. A canvas re-encode
       * drops the EXIF orientation tag, so without this every portrait photo
       * from a phone comes back rotated — with no way to tell afterwards.
       */
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size < 2 * 1024 * 1024) return file;

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);

      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      );
      if (!blob || blob.size >= file.size) return file;

      return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg' });
    } catch {
      // A browser without createImageBitmap options, or a file it cannot
      // decode: upload the original rather than failing the attachment.
      return file;
    }
  }
}

interface BaserowUploadResponse {
  url: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  is_image: boolean;
  image_width: number | null;
  image_height: number | null;
  thumbnails?: { tiny?: { url: string }; small?: { url: string }; card?: { url: string } } | null;
}

function toUploaded(response: BaserowUploadResponse): UploadedFile {
  return {
    url: response.url,
    name: response.name,
    originalName: response.original_name,
    size: response.size,
    mimeType: response.mime_type,
    isImage: response.is_image,
    width: response.image_width ?? undefined,
    height: response.image_height ?? undefined,
    thumbnailUrl: response.thumbnails?.small?.url ?? response.thumbnails?.card?.url
  };
}

function replaceExtension(name: string, extension: string): string {
  return name.replace(/\.[^.]+$/, '') + '.' + extension;
}
