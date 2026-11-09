export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <form method="post" action="/api/login" className="card login-card">
        <span className="brand">
          <span className="brand-mark" aria-hidden />
          {process.env.DASHBOARD_TITLE || 'Dashboards'}
        </span>
        <h1>Log in</h1>
        {error ? (
          <p className="callout bad" role="alert">
            That password is not right.
          </p>
        ) : null}
        <label htmlFor="password">Dashboard password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        <button type="submit" className="primary">
          Log in
        </button>
      </form>
    </main>
  );
}
