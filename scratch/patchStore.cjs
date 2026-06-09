const fs = require('fs');
const path = 'src/store.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes("import toast")) {
  code = code.replace("import { runRelationalMigration }", "import toast from 'react-hot-toast';\nimport { runRelationalMigration }");
}

if (!code.includes("const safeDb")) {
  const helper = `
const safeDb = async (promise: Promise<any>) => {
  try {
    const { error } = await promise;
    if (error) {
      console.error(error);
      toast.error('Nätverksfel: Kunde inte spara ändringen till molnet. Data kan gå förlorad om du stänger appen.');
    }
  } catch (err) {
    console.error(err);
    toast.error('Nätverksfel: Kunde inte spara ändringen till molnet. Data kan gå förlorad om du stänger appen.');
  }
};
`;
  code = code.replace("export function useStore", helper + "\nexport function useStore");
}

// Replace mutating calls
code = code.replace(/await supabase\.from\([^)]+\)\.(insert|update|upsert|delete)\([^;]+;/g, match => {
  // match is like "await supabase.from('bills').insert({...});"
  const inner = match.substring(6, match.length - 1); // remove "await " and ";"
  return `await safeDb(${inner});`;
});

fs.writeFileSync(path, code);
console.log("Patched store.ts successfully");
