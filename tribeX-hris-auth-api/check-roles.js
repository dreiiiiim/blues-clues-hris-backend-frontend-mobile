const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: user, error: userErr } = await supabase
    .from('user_profile')
    .select('*')
    .eq('username', 'rickgrimes')
    .maybeSingle();

  if (userErr) {
    console.error('Error fetching user:', userErr);
    return;
  }
  if (!user) {
    console.error('User not found');
    return;
  }

  console.log('User Profile:', user);

  const { data: assignments, error: assignmentsErr } = await supabase
    .from('user_role_assignments')
    .select('*, role(*)')
    .eq('user_id', user.user_id);

  if (assignmentsErr) {
    console.error('Error fetching assignments:', assignmentsErr);
  } else {
    console.log('Role Assignments:', JSON.stringify(assignments, null, 2));
  }
}

main();
