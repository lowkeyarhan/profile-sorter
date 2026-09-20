import fs from "fs";
import path from "path";

export function loadPrompt(
  name: string,
  vars: Record<string, string>,
): { system: string; user: string } {
  const raw = fs.readFileSync(
    path.join(__dirname, "..", "..", "prompts", `${name}.md`),
    "utf8",
  );
  let text = raw;
  for (const [k, v] of Object.entries(vars))
    text = text.replaceAll(`{{${k}}}`, v);
  const leftover = text.match(/\{\{\w+\}\}/);
  if (leftover)
    throw new Error(`prompt ${name} has unfilled variable ${leftover[0]}`);
  const system = section(text, "## System");
  const user = section(text, "## User");
  if (!system || !user)
    throw new Error(`prompt ${name} must have ## System and ## User sections`);
  return { system, user };
}

function section(text: string, head: string): string {
  const i = text.indexOf(head);
  if (i < 0) return "";
  const next = text.indexOf("## ", i + head.length);
  return text.slice(i + head.length, next < 0 ? undefined : next).trim();
}
