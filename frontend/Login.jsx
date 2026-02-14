// Login.jsx
const handleLogin = async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) alert(error.message);
};
