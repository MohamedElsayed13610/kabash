// Creates the first owner (or any staff) account. The password is typed here, hidden, never in chat.
// Usage: node --env-file=.env.local scripts/create-owner.mjs <email> "<الاسم>" [owner|manager|cashier]
import { createClient } from "@supabase/supabase-js";
import readline from "node:readline";

const [email, name, role = "owner"] = process.argv.slice(2);
if (!email || !name || !["owner", "manager", "cashier"].includes(role)) {
  console.error('Usage: node --env-file=.env.local scripts/create-owner.mjs <email> "<الاسم>" [owner|manager|cashier]');
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase keys. Run with: node --env-file=.env.local ...");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = (s) => (s.includes(question) ? write.call(rl, s) : write.call(rl, s.replace(/[^\r\n]/g, "")));
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askHidden("كلمة السر (8 حروف على الأقل / password, 8+ chars): ");
const again = await askHidden("اكتبها تاني للتأكيد / confirm: ");
if (password !== again) {
  console.error("Passwords do not match.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("Could not create the user:", error.message);
  process.exit(1);
}
const { error: pErr } = await db.from("profiles").upsert({ user_id: data.user.id, name, role, active: true });
if (pErr) {
  await db.auth.admin.deleteUser(data.user.id);
  console.error("Could not create the profile (user rolled back):", pErr.message);
  process.exit(1);
}
console.log(`Created ${role} "${name}" <${email}>. You can sign in at /staff/login`);
