# Worker RBAC — Testing Guide

> **Audience**: Backend testers and teammates who need to verify the new Worker role and module-scoped access control via the FastAPI Swagger UI.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1 — Create a Worker User](#step-1--create-a-worker-user)
4. [Step 2 — Assign the Worker Role](#step-2--assign-the-worker-role)
5. [Step 3 — Manage Module Permissions](#step-3--manage-module-permissions)
6. [Step 4 — Test Access Control](#step-4--test-access-control)
7. [Module Keys Reference](#module-keys-reference)
8. [API Endpoints Reference](#api-endpoints-reference)
9. [Expected Behavior Summary](#expected-behavior-summary)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Worker role introduces **module-scoped, read/create/update-only access**. Unlike Admin or other roles:

- Workers can only access modules that have been **explicitly granted** to them by an Admin.
- Workers are **blocked from all DELETE operations** across every module.
- The **Dashboard** module is always granted implicitly — it cannot be revoked.
- Admin users bypass all worker restrictions entirely.

---

## Prerequisites

1. **Backend server running** — Start the FastAPI backend (`uvicorn app.main:app --reload`).
2. **Migration applied** — Ensure `011_worker_role_permissions.sql` has been executed on the Supabase database. This migration:
   - Seeds the `worker` role into the `roles` table.
   - Creates the `worker_module_permissions` table.
3. **Admin account** — You need an Admin user's credentials to manage worker permissions.
4. **Swagger UI** — Open `http://localhost:8000/docs` in your browser.

---

## Step 1 — Create a Worker User

1. Open Swagger UI → **Authentication** section.
2. Use `POST /api/v1/auth/register` or `POST /api/v1/users/` to create a new user.
3. Note the **user ID** (UUID) from the response — you will need it for the next steps.

---

## Step 2 — Assign the Worker Role

1. **Authorize as Admin** — Click the **Authorize** button (lock icon) at the top of Swagger and enter your Admin bearer token.
2. Navigate to the **Users** section.
3. Use `PUT /api/v1/users/{user_id}/roles` to assign the `worker` role:
   ```json
   {
     "roles": ["worker"]
   }
   ```
4. Verify by calling `GET /api/v1/users/{user_id}` — the response should include `"roles": ["worker"]`.

---

## Step 3 — Manage Module Permissions

All module permission endpoints require **Admin authorization**. They are located under the **Users** section in Swagger.

### 3a. View Current Modules

**`GET /api/v1/users/{user_id}/worker-modules`**

Returns the list of granted module keys. A fresh worker will only have `["dashboard"]`.

### 3b. Grant a Single Module

**`POST /api/v1/users/{user_id}/worker-modules/{module_key}`**

- Replace `{module_key}` with one of the valid keys (see [Module Keys Reference](#module-keys-reference)).
- Example: `POST /api/v1/users/{user_id}/worker-modules/orders`
- Response: `{"detail": "Module 'orders' granted to user <user_id>"}`

### 3c. Replace All Modules at Once

**`PUT /api/v1/users/{user_id}/worker-modules`**

Send a JSON body with the full list of modules you want the worker to have:

```json
{
  "modules": ["orders", "inventory", "bom", "wip"]
}
```

- `dashboard` is always included automatically — you don't need to list it.
- Any previously granted modules **not** in this list will be **removed**.

### 3d. Revoke a Single Module

**`DELETE /api/v1/users/{user_id}/worker-modules/{module_key}`**

- Example: `DELETE /api/v1/users/{user_id}/worker-modules/orders`
- Note: You **cannot** revoke `dashboard`.

### 3e. Remove All Modules (Dashboard Only)

Use the replace endpoint with an empty list:

```json
{
  "modules": []
}
```

This leaves only the implicit `dashboard` access.

---

## Step 4 — Test Access Control

### Testing Module Access

1. **Log in as the worker** — Use the worker's credentials to get a bearer token via `POST /api/v1/auth/login`.
2. **Authorize Swagger** with the worker's token.
3. **Try accessing a granted module** — e.g., if `orders` was granted, call `GET /api/v1/orders/`. You should receive a normal `200` response.
4. **Try accessing a non-granted module** — e.g., if `bom` was NOT granted, call `GET /api/v1/boms/`. You should receive:
   ```json
   {
     "detail": "Access to module 'bom' has not been granted"
   }
   ```
   HTTP status: **403 Forbidden**

### Testing DELETE Blocking

1. While authorized as the worker, try any DELETE endpoint — for example, `DELETE /api/v1/orders/{order_id}`.
2. Even if the worker has `orders` module access, the response should be:
   ```json
   {
     "detail": "Workers are not permitted to delete records"
   }
   ```
   HTTP status: **403 Forbidden**

### Testing /auth/me

1. While authorized as the worker, call `GET /api/v1/auth/me`.
2. The response should include a `worker_modules` array listing all granted modules (always includes `dashboard`):
   ```json
   {
     "id": "...",
     "email": "...",
     "roles": ["worker"],
     "worker_modules": ["dashboard", "orders", "inventory"]
   }
   ```

---

## Module Keys Reference

Use these **exact strings** when granting or revoking modules:

| Module Key          | Frontend Page       | Description                                      |
|---------------------|---------------------|--------------------------------------------------|
| `dashboard`         | Dashboard           | Always granted implicitly, cannot be revoked      |
| `bom`               | BOM Planner         | Bill of Materials management                      |
| `orders`            | Purchase Orders     | Purchase order creation and tracking              |
| `working-order`     | Working Order       | Production work order management                  |
| `wip`               | WIP Board           | Work-in-Progress live board and tracking           |
| `transfer`          | Material Transfer   | Material transfers between locations               |
| `material-request`  | Material Request    | Material requisition requests                      |
| `qc`                | QC Check            | Quality Control inspection and defect analysis     |
| `inventory`         | Inventory           | Inventory and inventory items management           |
| `gate-entry`        | Gate Entry          | Inward gate entry management                       |
| `gate-exit`         | Gate Exit           | Outward gate exit and dispatch management          |

---

## API Endpoints Reference

All endpoints below are under the **Users** section and require **Admin** authorization.

| Method   | Endpoint                                              | Description                          |
|----------|-------------------------------------------------------|--------------------------------------|
| `GET`    | `/api/v1/users/{user_id}/worker-modules`              | List granted modules for a worker    |
| `PUT`    | `/api/v1/users/{user_id}/worker-modules`              | Replace full module list             |
| `POST`   | `/api/v1/users/{user_id}/worker-modules/{module_key}` | Grant a single module                |
| `DELETE` | `/api/v1/users/{user_id}/worker-modules/{module_key}` | Revoke a single module               |

---

## Expected Behavior Summary

| Scenario                                    | Expected Result                                                |
|---------------------------------------------|----------------------------------------------------------------|
| Worker accesses a **granted** module         | Normal `200` response with data                                |
| Worker accesses a **non-granted** module     | `403` — "Access to module '{key}' has not been granted"        |
| Worker attempts a **DELETE** on any module   | `403` — "Workers are not permitted to delete records"          |
| Worker calls `/auth/me`                      | Response includes `worker_modules` array                       |
| Admin accesses any module                    | Normal response — Admin bypasses all worker restrictions       |
| Non-worker role (e.g., Planner, Supervisor)  | Normal response — module restrictions only apply to workers    |
| Worker accesses Dashboard                    | Always allowed — dashboard is implicitly granted               |

---

## Troubleshooting

### Worker-module endpoints not appearing in Swagger
- **Restart the backend server** to pick up the latest code changes.
- **Hard-refresh Swagger** (`Ctrl+Shift+R`) to clear the cached OpenAPI schema.

### "Access to module '...' has not been granted" even after granting
- Verify the module was granted by calling `GET /api/v1/users/{user_id}/worker-modules`.
- Ensure you used the **correct module key** (see table above) — keys are case-sensitive and use hyphens.
- The worker must **re-login** (get a new token) if the `/auth/me` cache is stale.

### Worker can still access a module after revoking
- Ensure the worker gets a **new bearer token** after module changes.
- Verify revocation via `GET /api/v1/users/{user_id}/worker-modules`.

### Migration not applied
- Run `011_worker_role_permissions.sql` on your Supabase database via the SQL editor.
- Verify the `worker` role exists: `SELECT * FROM roles WHERE name = 'worker';`
- Verify the table exists: `SELECT * FROM worker_module_permissions;`
