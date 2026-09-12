# AMS staff login access

The public login button may be viewed by anyone. Access is enforced by AMS after
authentication, not by hiding its URL. A VA Portal session, representative mapping
or VATSIM membership alone grants no AMS access.

The AMS image built from this repository supports `AUTH_STAFF_ONLY=true`. The
Compose configuration enables it and sets `AUTH_STAFF_ROLE_NAMES` to:

- Vice President
- Director
- Assistant Director
- Training Coordinator
- Senior Audit Manager
- Audit Manager

Every user login, including password and SSO login, requires an active existing
AMS account assigned to an allowed role with application or administrator access.
The policy checks the assigned Directus role, not the user's profile title.
Roles named VA Representative, Public, API Admin or Administrator are not on this
list. Do not add a broad role merely to permit a nonstaff account.
An empty allowlist denies all user logins while staff-only mode is enabled.

SSO public registration is explicitly disabled by
`AUTH_VATDEVCONNECT_ALLOW_PUBLIC_REGISTRATION=false`. Staff accounts must be
provisioned by an administrator with the VATSIM provider and their verified CID
as the external identifier. Keep representatives in `VA_Representatives`; they
do not need a `directus_users` account or a staff role for the VA Portal.

Session renewal rechecks the current role and deletes a refresh session when its
user no longer meets the staff policy. Already issued access tokens may remain
valid until their configured expiry. Static service tokens are not interactive
logins and are outside this change; retain their existing restricted permissions.

## Deployment and verification

1. Review the live AMS staff accounts and role assignments. Ensure each approved
   staff account uses an allowed role; verify Director/Assistant Director/Training
   Coordinator profile titles are not mistaken for role assignments. Do not give
   representative accounts any staff role or administrator privileges.
2. Build and deploy **AMS** using `Dockerfile.ams`, and apply the three settings
   above to its runtime configuration. Deployments outside Compose must set them
   explicitly. Restarting Flask or Nginx alone does not enable this restriction.
3. Disable or remove incorrectly provisioned nonstaff AMS accounts, revoke their
   sessions, and account for outstanding access-token lifetimes. Review any API
   tokens, shares and public collection permissions separately.
4. Test with an approved staff SSO account, an unlinked VATSIM member, and an
   existing nonstaff account. Only approved staff should receive an AMS user
   session. Confirm removing a staff role prevents login and session renewal.
5. Verify the independent VA Portal still permits linked representatives to
   submit events while their accounts cannot log in to AMS.

No live roles, accounts, sessions or deployment settings were changed locally.
Production access cannot be confirmed until the deployed configuration and
accounts have been reviewed and these login checks have passed.
