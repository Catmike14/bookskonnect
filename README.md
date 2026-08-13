<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c582d587-9adc-40e7-9cd6-e8192eab61d5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Without `DATABASE_URL` set, accounts, sessions, tasks, clients, categories, and deadlines all live in memory and reset every time the server restarts -- fine for local development, not for anything real.

## Security setup (do this before any real deployment)

- **Set `ADMIN_KEY`** in your environment before the first deploy. If it's left unset, the app falls back to the default `ADMIN123`, and anyone who knows that can self-register as a System Administrator. Pick something long and random.
- If you've already deployed with the default key, sign up as the first admin, then immediately go to **Admin Hub → Security** and rotate the key (or lock self-registration entirely once your team is set up).
- Set `DATABASE_URL` to a real Postgres instance. Without it, every account and session is wiped on every restart/redeploy.
- Set `NODE_ENV=production` in production so session cookies get the `secure` flag (HTTPS only).
- There is no email-based password reset in this app (no email provider is configured). If someone forgets their password, a System Administrator resets it for them from Admin Hub → Users, which generates a one-time temporary password to relay to them directly.

