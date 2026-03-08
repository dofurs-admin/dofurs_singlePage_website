# Admin Health Regression Checklist

Use this checklist after schema or admin API changes.

## Preconditions
- Admin dashboard loads and you are signed in as `admin` or `staff`.
- Latest DB migrations are applied.

## 1) Schema Health Check
- Navigate to `Dashboard -> Admin -> Health`.
- Click `Run Schema Check`.
- Expect:
  - Status badge: `Schema Healthy`
  - No failed check for `users.email_ci.unique_index.exists`

## 2) Providers Functional API Check
- In the same Health panel, run functional checks.
- Verify the `Providers API` row for `/api/admin/providers`.
- Expect:
  - Status: `healthy`
  - No `HTTP 404`

## 3) Direct Endpoint Sanity (optional)
- Open browser devtools Network tab while loading the admin providers view.
- Confirm request to `/api/admin/providers` returns `200` with JSON body containing `providers` array.

## Pass Criteria
- Both checks above are healthy in the same run.
- No red status badge remains in Health for schema or providers API.
