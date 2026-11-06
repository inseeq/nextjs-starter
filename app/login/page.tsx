export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>Log in</h1>
      {error ? <p className="error">That password is not right.</p> : null}
      <form method="post" action="/api/login">
        <label htmlFor="password">Dashboard password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        <button type="submit">Log in</button>
      </form>
    </main>
  );
}
