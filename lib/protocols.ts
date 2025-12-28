// lib/protocols.ts
export const ROBUFFER_RECIPE = {
  name: "ROBUFFER™",
  baseVolumeLiters: 100, 
  ingredients: [
    { name: "Calcium Chloride Dihydrate", formula: "CaCl2·2H2O", amountPer100L: 5.0, unit: "g" },
    { name: "Epsom Salt", formula: "MgSO4·7H2O", amountPer100L: 2.5, unit: "g" },
    { name: "Baking Soda", formula: "NaHCO3", amountPer100L: 3.5, unit: "g" }
  ],
  targets: {
    pH: "7.2 - 7.6",
    GH: "4 - 10 dGH",
    KH: "3 - 8 dKH"
  }
};
