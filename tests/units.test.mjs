import test from "node:test";
import assert from "node:assert/strict";
const mmToPx=(mm,dpi)=>(mm/25.4)*dpi;
const mmToPt=mm=>(mm/25.4)*72;
test("25.4 mm at 300 DPI is 300 px",()=>assert.equal(mmToPx(25.4,300),300));
test("A5 dimensions at 300 DPI",()=>{assert.ok(Math.abs(mmToPx(148,300)-1748.031496)<1e-5);assert.ok(Math.abs(mmToPx(210,300)-2480.314961)<1e-5)});
test("25.4 mm is 72 pt",()=>assert.equal(mmToPt(25.4),72));
test("A5 raster rounding",()=>{assert.deepEqual([Math.round(mmToPx(148,300)),Math.round(mmToPx(210,300))],[1748,2480]);assert.deepEqual([Math.round(mmToPx(148,600)),Math.round(mmToPx(210,600))],[3496,4961])});
