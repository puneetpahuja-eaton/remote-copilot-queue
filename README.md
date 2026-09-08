# Remote Copilot Queue

Netlify hosts the mobile UI. Supabase authenticates users and stores commands.
This local worker polls Supabase over outbound HTTPS, runs the authenticated
local Copilot CLI, and writes results back. No laptop port is exposed publicly.

## Deploy

1. Create a Supabase project and run `supabase.sql` in its SQL Editor.
2. In Supabase Authentication, enable Email and configure an allowed redirect
   URL for the future Netlify site.
3. Copy `site/config.example.js` to `site/config.js`, then set the project's
   URL and anon key. The anon key is intended for browser use; never put the
   service-role key in this file.
4. Create a new Netlify site from this `remote-copilot-queue` directory.
   Netlify publishes the `site` folder automatically using `netlify.toml`.
5. On the laptop, set environment variables in the terminal that runs worker:

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SERVICE_ROLE_SECRET"
$env:COPILOT_WORKSPACE = "C:\Puneet\Eaton\Project\Code\cps-dim-rtos-panelboard"
npm run start:worker
```

6. Use the Netlify URL from any mobile network. Create an account, sign in,
   submit a command, and view the result.

## Corporate TLS inspection

If the worker prints `SELF_SIGNED_CERT_IN_CHAIN`, the company network is
intercepting HTTPS with an internal certificate authority that Node.js does not
yet trust. Obtain the company root CA certificate from IT as a PEM-encoded
`.pem` or `.crt` file, save it outside this repository, then set this variable
in the same PowerShell window before starting the worker:

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\Path\To\company-root-ca.pem"
```

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`; that disables certificate
verification and makes the command service unsafe.

## Security

- Keep `SUPABASE_SERVICE_ROLE_KEY` exclusively on the laptop.
- `site/config.js` is ignored by Git; it contains only browser-safe URL/anon key.
- RLS permits each user to read and insert only their own commands.
- The worker is the only service that can claim or update queued work.
- The worker uses automatic Copilot tool approvals. Restrict Supabase auth to
  your account and stop the worker when remote execution is not required.
