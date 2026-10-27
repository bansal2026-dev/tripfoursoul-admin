# Production migration

Run the SQL migration against the production PostgreSQL database before deploying the application release:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/20261014_add_lead_attribution.sql
```

The statements are idempotent and add nullable columns, so existing rows and website clients that omit attribution fields remain valid. Confirm the five columns exist in `information_schema.columns`, then deploy the app. Keep `LEADS_API_KEY` configured on both the website integration and admin backend. After deployment, submit one normal website test lead with attribution values and verify them in the admin lead list/details and filters.
