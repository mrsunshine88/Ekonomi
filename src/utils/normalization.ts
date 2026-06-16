export function normalizeLearningString(name: string): string | null {
  if (!name) return null;
  
  // 1. Convert to uppercase and trim
  let s = name.toUpperCase().trim();
  
  // 2. Remove common bank/company noise words
  const noiseWords = [
    ' AB', ' AKTIEBOLAG', ' SVERIGE', ' AUTOGIRO', ' BG', ' PG', ' KORTKÖP', 
    ' KORTTRANSAKTION', ' ÖVERFÖRING', ' SWISH', ' BETALNING', ' KONTO', ' INC', ' LLC', '.COM'
  ];
  
  for (const noise of noiseWords) {
    s = s.replace(new RegExp(noise, 'g'), ' ');
  }
  
  // 3. Remove non-alphanumeric characters and extra spaces
  s = s.replace(/[^A-Z0-9ÅÄÖ ]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  
  // 4. Quality Control: if length is under 3, return null (prevents garbage like 'A', 'AB', 'SE')
  if (s.length < 3) {
    return null;
  }
  
  return s;
}
