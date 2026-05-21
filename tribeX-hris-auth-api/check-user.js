const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users, error } = await supabase
    .from('user_profile')
    .select('*, role(*)')
    .or('username.eq.rickgrimes,email.eq.rickgrimes');

  if (error) {
    console.error('Error fetching user:', error);
  } else {
    console.log('User found:', JSON.stringify(users, null, 2));
  }
}

main();
