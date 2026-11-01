const fs = require("fs");
const p = "src/lib/i18n/dictionaries.ts";
let s = fs.readFileSync(p, "utf8");
const lines = s.split("\n");
const nav = [
  '    timesheet: "Timesheet",',
  '    leave: "Leave",',
  '    holidays: "Holidays",',
  '    management: "Management",',
];
// Insert before each locale's platform value `workspace:` line.
let count = 0;
const out = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (/^workspace: "/.test(t)) {
    for (const n of nav) out.push(n);
    count++;
  }
  out.push(lines[i]);
}
fs.writeFileSync(p, out.join("\n"), "utf8");
console.log("inserted before workspace value lines:", count);
