import React, { useState } from 'react';
import { ROBUFFER_RECIPE } from '../lib/protocols';

export default function RoBufferCalculator() {
  const [volume, setVolume] = useState(100);

  // Math: (User Volume / Base Volume) * Base Grams
  const calculateGrams = (baseGrams: number) => {
    return ((volume / ROBUFFER_RECIPE.baseVolumeLiters) * baseGrams).toFixed(2);
  };

  return (
    <div className="p-6 border rounded-xl shadow-lg bg-white max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-800 mb-2">{ROBUFFER_RECIPE.name} Calculator</h2>
      <p className="text-gray-600 mb-4">Enter your total water volume to calculate the required dose.</p>
      
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-1 text-gray-700">Tank Volume (Liters)</label>
        <input 
          type="number" 
          value={volume} 
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full p-3 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
        />
      </div>

      <div className="space-y-4">
        {ROBUFFER_RECIPE.ingredients.map((ing) => (
          <div key={ing.name} className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
            <div>
              <p className="font-bold text-gray-800">{ing.name}</p>
              <p className="text-xs text-gray-500 font-mono">{ing.formula}</p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-blue-700">{calculateGrams(ing.amountPer100L)}</span>
              <span className="ml-1 font-bold text-blue-700">{ing.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 italic">
        <strong>Targeting:</strong> pH {ROBUFFER_RECIPE.targets.pH} | GH {ROBUFFER_RECIPE.targets.GH}
      </div>
    </div>
  );
}
