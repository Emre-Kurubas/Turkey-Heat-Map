import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/*
 * jsdom does not implement PointerEvent at all. Without it, dispatching
 * `pointerenter` falls back to a plain Event and silently drops clientX/clientY
 * — so a test asserting hover coordinates would compare against undefined.
 * The map is driven entirely by pointer events, so this gap is filled once here
 * rather than worked around in each test.
 */
if (typeof globalThis.PointerEvent !== 'function') {
  class PointerEventPolyfill extends MouseEvent implements PointerEvent {
    readonly pointerId: number;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;
    readonly tangentialPressure: number;
    readonly tiltX: number;
    readonly tiltY: number;
    readonly twist: number;
    readonly altitudeAngle: number;
    readonly azimuthAngle: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.width = init.width ?? 1;
      this.height = init.height ?? 1;
      this.pressure = init.pressure ?? 0;
      this.tangentialPressure = init.tangentialPressure ?? 0;
      this.tiltX = init.tiltX ?? 0;
      this.tiltY = init.tiltY ?? 0;
      this.twist = init.twist ?? 0;
      this.altitudeAngle = init.altitudeAngle ?? 0;
      this.azimuthAngle = init.azimuthAngle ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? false;
    }

    getCoalescedEvents(): PointerEvent[] { return []; }
    getPredictedEvents(): PointerEvent[] { return []; }
  }

  globalThis.PointerEvent = PointerEventPolyfill;
}

// Element.setPointerCapture / releasePointerCapture are likewise absent.
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = function setPointerCapture(): void {};
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean { return false; };
}

// RTL does not register its own auto-cleanup when `globals: false`.
afterEach(() => { cleanup(); });
