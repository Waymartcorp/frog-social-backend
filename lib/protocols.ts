// lib/protocols.ts
export const ROBUFFER_RECIPE = {
  name: "ROBUFFER™ Full Remineralizer",
  method: "80% Instant Ocean Base / 20% ROBUFFER™ Top-off",
  baseVolumeLiters: 100,
  ingredients: [
    { name: "Potassium Sulfate", formula: "K2SO4", amountPer100L: 9.0, unit: "g", purpose: "Major Cation & Plant/Bio Support" },
    { name: "Calcium Sulfate", formula: "CaSO4·2H2O", amountPer100L: 6.5, unit: "g", purpose: "Primary GH Booster (Calcium)" },
    { name: "Magnesium Sulfate", formula: "MgSO4·7H2O", amountPer100L: 4.5, unit: "g", purpose: "Secondary GH Booster (Magnesium)" },
    { name: "Calcium Chloride", formula: "CaCl2", amountPer100L: 2.0, unit: "g", purpose: "Solubility & Immediate GH" },
    { name: "Baking Soda", formula: "NaHCO3", amountPer100L: 1.5, unit: "g", purpose: "KH & pH Stability" }
  ],
  targets: {
    pH: "7.4 - 7.6",
    GH: "10 - 14 dGH", // Increased for mineral density
    KH: "3 - 5 dKH"
  }
};
