// Run once to seed the super admin account.
// Usage: npx ts-node sql/seed-superadmin.ts
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function seed() {
  const email = 'superadmin@bluesclues.com';
  const password = 'SuperAdmin@2025!';
  const name = 'Super Admin';

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: 'super_admin', name },
    email_confirm: true,
  });
  if (authError) { console.error('Auth create failed:', authError.message); process.exit(1); }

  const { error: dbError } = await supabase.from('super_admin_users').insert({
    id: authUser.user.id,
    email,
    name,
  });
  if (dbError) { console.error('DB insert failed:', dbError.message); process.exit(1); }

  console.log('Super admin seeded successfully');
  console.log('  Email   :', email);
  console.log('  Password:', password);
  console.log('  User ID :', authUser.user.id);
}

seed();
