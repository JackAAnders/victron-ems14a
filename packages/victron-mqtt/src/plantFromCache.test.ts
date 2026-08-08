import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gridSignalFromAux } from "./auxMap.js";
import { VenusValueCache } from "./cache.js";
import { plantStateFromCache } from "./plantFromCache.js";

describe("plantStateFromCache", () => {
  it("aggregates two MPPTs and derives house load without wallbox", () => {
    const cache = new VenusValueCache();
    cache.seed("solarcharger", "280", "Yield/Power", 2000);
    cache.seed("solarcharger", "281", "Yield/Power", 3000);
    cache.seed("system", "0", "Dc/Battery/Soc", 62);
    cache.seed("system", "0", "Dc/Battery/Power", 500);
    cache.seed("system", "0", "Ac/Grid/L1/Power", 800);
    cache.seed("system", "0", "Ac/Consumption/L1/Power", 4500);
    cache.seed("evcharger", "1", "Ac/Power", 3500);
    cache.seed("evcharger", "1", "MaxCurrent", 16);
    cache.seed("evcharger", "1", "Status", 2);

    const plant = plantStateFromCache(cache);
    assert.equal(plant.pvKw, 5);
    assert.equal(plant.mppt?.length, 2);
    assert.ok(Math.abs(plant.houseLoadKw - 1) < 1e-9);
    assert.equal(plant.wallbox?.powerKw, 3.5);
    assert.equal(plant.batterySocPercent, 62);
  });
});

describe("gridSignalFromAux", () => {
  it("maps limited digital input to 4.2 kW ceiling", () => {
    const cache = new VenusValueCache();
    cache.seed("digitalinput", "1", "State", 1);
    const signal = gridSignalFromAux(cache, {
      limitedInput: { service: "digitalinput", instance: "1" },
      limitedKw: 4.2,
    });
    assert.equal(signal.mode, "limited");
    assert.equal(signal.maxSteuveGridKw, 4.2);
  });
});
