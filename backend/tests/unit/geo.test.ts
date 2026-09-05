import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "../../src/utils/geo.js";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical coordinates", () => {
    const point = { latitude: 23.0225, longitude: 72.5714 };
    expect(haversineDistanceKm(point, point)).toBe(0);
  });

  it("computes a plausible distance between two Ahmedabad points", () => {
    const a = { latitude: 23.0225, longitude: 72.5714 };
    const b = { latitude: 23.0339, longitude: 72.5619 };
    const distance = haversineDistanceKm(a, b);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(5);
  });

  it("is symmetric", () => {
    const a = { latitude: 12.9716, longitude: 77.5946 };
    const b = { latitude: 19.076, longitude: 72.8777 };
    expect(haversineDistanceKm(a, b)).toBe(haversineDistanceKm(b, a));
  });
});
