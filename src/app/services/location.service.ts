import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  center?: GeoPosition;
  radius?: number; // meters, for circle type
  points?: GeoPosition[]; // for polygon type
  enabled: boolean;
}

export interface GeofenceEvent {
  geofenceId: string;
  geofenceName: string;
  type: 'enter' | 'exit' | 'dwell';
  position: GeoPosition;
  timestamp: Date;
}

export interface GeocodingResult {
  address: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  formattedAddress: string;
}

export interface LocationTrackingOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  distanceFilter?: number; // minimum meters between updates
  intervalMs?: number; // tracking interval
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly http = inject(HttpClient);

  // Reactive state
  private readonly _currentPosition = signal<GeoPosition | null>(null);
  private readonly _isTracking = signal(false);
  private readonly _lastError = signal<string | null>(null);
  private readonly _permissionStatus = signal<PermissionState>('prompt');
  private readonly _activeGeofences = signal<Geofence[]>([]);

  // Public signals
  readonly currentPosition = this._currentPosition.asReadonly();
  readonly isTracking = this._isTracking.asReadonly();
  readonly lastError = this._lastError.asReadonly();
  readonly permissionStatus = this._permissionStatus.asReadonly();
  readonly activeGeofences = this._activeGeofences.asReadonly();

  readonly hasLocation = computed(() => this._currentPosition() !== null);

  // Event emitters
  private readonly positionUpdate$ = new Subject<GeoPosition>();
  private readonly geofenceEvent$ = new Subject<GeofenceEvent>();

  // Tracking state
  private watchId: number | null = null;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;
  private lastPosition: GeoPosition | null = null;
  private readonly defaultOptions: LocationTrackingOptions = {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 10000,
    distanceFilter: 10,
    intervalMs: 5000,
  };

  // Google Maps API key
  private readonly mapsApiKey = environment.googleMapsApiKey || '';

  constructor() {
    this.checkPermissionStatus();
  }

  /**
   * Check current geolocation permission status
   */
  async checkPermissionStatus(): Promise<PermissionState> {
    if (!('permissions' in navigator)) {
      return 'prompt';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      this._permissionStatus.set(result.state);

      result.onchange = () => {
        this._permissionStatus.set(result.state);
      };

      return result.state;
    } catch {
      return 'prompt';
    }
  }

  /**
   * Request location permission and get current position
   */
  async requestPermission(): Promise<boolean> {
    try {
      const position = await this.getCurrentPosition();
      return position !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get current position once
   */
  getCurrentPosition(options?: LocationTrackingOptions): Promise<GeoPosition | null> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        this._lastError.set('Geolocation is not supported');
        resolve(null);
        return;
      }

      const opts = { ...this.defaultOptions, ...options };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const geoPosition = this.convertPosition(position);
          this._currentPosition.set(geoPosition);
          this._lastError.set(null);
          resolve(geoPosition);
        },
        (error) => {
          this._lastError.set(this.getErrorMessage(error));
          resolve(null);
        },
        {
          enableHighAccuracy: opts.enableHighAccuracy,
          maximumAge: opts.maximumAge,
          timeout: opts.timeout,
        }
      );
    });
  }

  /**
   * Start continuous location tracking
   */
  startTracking(options?: LocationTrackingOptions): void {
    if (this._isTracking()) {
      console.log('Already tracking location');
      return;
    }

    if (!('geolocation' in navigator)) {
      this._lastError.set('Geolocation is not supported');
      return;
    }

    const opts = { ...this.defaultOptions, ...options };
    this._isTracking.set(true);

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const geoPosition = this.convertPosition(position);

        // Apply distance filter
        if (opts.distanceFilter && this.lastPosition) {
          const distance = this.calculateDistance(this.lastPosition, geoPosition);
          if (distance < opts.distanceFilter) {
            return;
          }
        }

        this.lastPosition = geoPosition;
        this._currentPosition.set(geoPosition);
        this._lastError.set(null);
        this.positionUpdate$.next(geoPosition);

        // Check geofences
        this.checkGeofences(geoPosition);
      },
      (error) => {
        this._lastError.set(this.getErrorMessage(error));
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        maximumAge: opts.maximumAge,
        timeout: opts.timeout,
      }
    );
  }

  /**
   * Stop location tracking
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    this._isTracking.set(false);
  }

  /**
   * Get observable for position updates
   */
  onPositionUpdate(): Observable<GeoPosition> {
    return this.positionUpdate$.asObservable();
  }

  /**
   * Get observable for geofence events
   */
  onGeofenceEvent(): Observable<GeofenceEvent> {
    return this.geofenceEvent$.asObservable();
  }

  /**
   * Add a geofence to monitor
   */
  addGeofence(geofence: Geofence): void {
    this._activeGeofences.update(geofences => {
      const existing = geofences.findIndex(g => g.id === geofence.id);
      if (existing >= 0) {
        const updated = [...geofences];
        updated[existing] = geofence;
        return updated;
      }
      return [...geofences, geofence];
    });
  }

  /**
   * Remove a geofence
   */
  removeGeofence(geofenceId: string): void {
    this._activeGeofences.update(geofences =>
      geofences.filter(g => g.id !== geofenceId)
    );
  }

  /**
   * Check if a position is inside a geofence
   */
  isInsideGeofence(position: GeoPosition, geofence: Geofence): boolean {
    if (!geofence.enabled) return false;

    if (geofence.type === 'circle' && geofence.center && geofence.radius) {
      const distance = this.calculateDistance(position, geofence.center);
      return distance <= geofence.radius;
    }

    if (geofence.type === 'polygon' && geofence.points && geofence.points.length >= 3) {
      return this.isPointInPolygon(position, geofence.points);
    }

    return false;
  }

  /**
   * Calculate distance between two positions in meters
   */
  calculateDistance(pos1: GeoPosition, pos2: GeoPosition): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(pos2.lat - pos1.lat);
    const dLon = this.toRad(pos2.lng - pos1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(pos1.lat)) *
        Math.cos(this.toRad(pos2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Reverse geocode a position to get address
   */
  reverseGeocode(position: GeoPosition): Observable<GeocodingResult | null> {
    if (!this.mapsApiKey) {
      console.warn('Google Maps API key not configured');
      return from(Promise.resolve(null));
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${position.lat},${position.lng}&key=${this.mapsApiKey}`;

    return this.http.get<GoogleGeocodingResponse>(url).pipe(
      map(response => {
        if (response.status === 'OK' && response.results.length > 0) {
          const result = response.results[0];
          return this.parseGeocodingResult(result);
        }
        return null;
      }),
      catchError(() => from(Promise.resolve(null)))
    );
  }

  /**
   * Forward geocode an address to get position
   */
  geocode(address: string): Observable<GeoPosition | null> {
    if (!this.mapsApiKey) {
      console.warn('Google Maps API key not configured');
      return from(Promise.resolve(null));
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.mapsApiKey}`;

    return this.http.get<GoogleGeocodingResponse>(url).pipe(
      map(response => {
        if (response.status === 'OK' && response.results.length > 0) {
          const location = response.results[0].geometry.location;
          return {
            lat: location.lat,
            lng: location.lng,
            timestamp: new Date(),
          };
        }
        return null;
      }),
      catchError(() => from(Promise.resolve(null)))
    );
  }

  private convertPosition(position: GeolocationPosition): GeoPosition {
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude ?? undefined,
      altitudeAccuracy: position.coords.altitudeAccuracy ?? undefined,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
      timestamp: new Date(position.timestamp),
    };
  }

  private checkGeofences(position: GeoPosition): void {
    const geofences = this._activeGeofences();

    geofences.forEach(geofence => {
      const isInside = this.isInsideGeofence(position, geofence);
      const wasInside = this.lastPosition
        ? this.isInsideGeofence(this.lastPosition, geofence)
        : false;

      if (isInside && !wasInside) {
        this.geofenceEvent$.next({
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          type: 'enter',
          position,
          timestamp: new Date(),
        });
      } else if (!isInside && wasInside) {
        this.geofenceEvent$.next({
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          type: 'exit',
          position,
          timestamp: new Date(),
        });
      }
    });
  }

  private isPointInPolygon(point: GeoPosition, polygon: GeoPosition[]): boolean {
    let inside = false;
    const x = point.lat;
    const y = point.lng;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat;
      const yi = polygon[i].lng;
      const xj = polygon[j].lat;
      const yj = polygon[j].lng;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  private getErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied';
      case error.POSITION_UNAVAILABLE:
        return 'Location information unavailable';
      case error.TIMEOUT:
        return 'Location request timed out';
      default:
        return 'Unknown location error';
    }
  }

  private parseGeocodingResult(result: GoogleGeocodingResult): GeocodingResult {
    const components = result.address_components;

    const getComponent = (type: string): string | undefined => {
      const component = components.find(c => c.types.includes(type));
      return component?.long_name;
    };

    return {
      address: result.formatted_address,
      streetNumber: getComponent('street_number'),
      street: getComponent('route'),
      city: getComponent('locality') || getComponent('sublocality'),
      state: getComponent('administrative_area_level_1'),
      country: getComponent('country'),
      postalCode: getComponent('postal_code'),
      formattedAddress: result.formatted_address,
    };
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.positionUpdate$.complete();
    this.geofenceEvent$.complete();
  }
}

// Google Geocoding API types
interface GoogleGeocodingResponse {
  status: string;
  results: GoogleGeocodingResult[];
}

interface GoogleGeocodingResult {
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  address_components: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
}
