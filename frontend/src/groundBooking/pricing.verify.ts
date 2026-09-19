import assert from "node:assert/strict";
import { computeLocalPricing, inclusiveDays, listGroundRate } from "./pricing";

const base = {
  slot: "half_day" as const,
  startIso: "2026-10-05",
  endIso: "2026-10-05",
  groundRate: 6000,
  people: 10,
  foodOn: false,
  foodRate: 0,
  foodPeople: 0,
  transportOn: false,
  transportRate: 0,
  transportPeople: 0,
  umpireOn: false,
  umpireRate: 0,
  umpirePeople: 0,
  ballsOn: false,
  ballQty: 0,
  ballRate: 0,
};

{
  assert.equal(inclusiveDays("2026-10-05", "2026-10-05"), 1);
  assert.equal(inclusiveDays("2026-10-05", "2026-10-07"), 3);
  assert.equal(inclusiveDays("2026-10-07", "2026-10-05"), 1, "reversed range falls back to 1 day");
  assert.equal(inclusiveDays("2026-03-28", "2026-03-30"), 3, "DST-free midday parsing");
}

{
  assert.equal(listGroundRate("half_day", 1, 0), 6000);
  assert.equal(listGroundRate("full_day", 2, 0), 20000);
  assert.equal(listGroundRate("custom", 3, 4500), 4500, "custom is a flat total, not per day");
}

{
  const p = computeLocalPricing(base);
  assert.equal(p.totalRevenue, 6000);
  assert.equal(p.discountAmount, 0);
  assert.equal(p.discountRequested, false);
}

{
  const p = computeLocalPricing({ ...base, slot: "full_day", endIso: "2026-10-06", groundRate: 20000 });
  assert.equal(p.days, 2);
  assert.equal(p.listGroundRate, 20000);
  assert.equal(p.totalRevenue, 20000);
  assert.equal(p.discountRequested, false);
}

{
  const p = computeLocalPricing({ ...base, groundRate: 4500 });
  assert.equal(p.discountAmount, 1500);
  assert.equal(p.discountRequested, true, "under-list rate must raise an approval");
}

{
  const p = computeLocalPricing({ ...base, slot: "custom", groundRate: 4500 });
  assert.equal(p.discountRequested, false, "custom slot is its own list rate");
}

{
  const p = computeLocalPricing({
    ...base,
    endIso: "2026-10-07",
    umpireOn: true,
    umpireRate: 500,
    umpirePeople: 2,
    groundRate: 18000,
  });
  assert.equal(p.days, 3);
  assert.equal(p.umpireCost, 3000, "umpire bills rate x days x people");
}

{
  const p = computeLocalPricing({
    ...base,
    foodOn: true,
    foodRate: 200,
    foodPeople: 25,
    transportOn: true,
    transportRate: 150,
    transportPeople: 8,
    ballsOn: true,
    ballQty: 6,
    ballRate: 250,
  });
  assert.equal(p.foodCost, 5000, "add-on headcount is independent of event headcount");
  assert.equal(p.transportCost, 1200);
  assert.equal(p.ballCost, 1500);
  assert.equal(p.addOnTotal, 7700);
  assert.equal(p.totalRevenue, 13700);
}

{
  const p = computeLocalPricing({ ...base, groundRate: -5000, foodOn: true, foodRate: -10, foodPeople: 5 });
  assert.equal(p.groundRate, 0, "negative money is clamped");
  assert.equal(p.foodCost, 0);
}

console.log("pricing.verify.ts OK");
