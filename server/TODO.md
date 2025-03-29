# TODO List for PostgreSQL Migration

After migrating from DynamoDB to PostgreSQL, we need to fix the following issues:

## Authentication System
- ✅ Fix property name mismatch (`credentialID` -> `credentialId`)
- ✅ Add missing repository methods:
  - ✅ `addAuthenticator`
  - ✅ `getAuthenticatorByCredentialId`
  - ✅ `updateAuthenticatorCounter`
- ✅ Add mapper functions to convert between model types and shared types
- ✅ Fix type conversions (string/number) for counter
- ✅ Enable experimental decorators in tsconfig.json

## Device System
- ✅ Fix deviceService.ts:
  - ✅ Fix type mismatch in saveDevice (DeviceRegistration vs Device)
  - ✅ Update service to use Sequelize models properly
  - ✅ Convert between model and shared types with mapDeviceToShared
  - ✅ Properly handle errors with type safety
  - ✅ Use repository methods directly
  - ✅ Update method names (`getAllDevices` -> `getDevices`)

- ✅ Fix deviceRegistrationService.ts:
  - ✅ Update `registerDevice` method to accept DeviceRegistrationRequest type
  - ✅ Add missing repository methods:
    - ✅ `getAllDevices`
    - ✅ `getDeviceById`
    - ✅ `deactivateDevice`
  - ✅ Add missing 'active' property to DeviceRegistration model

## Tenant System
- ✅ Fix tenantService.ts:
  - ✅ Update service to use User relationship instead of direct properties:
    - ✅ Changed `member.userEmail` to `member.user?.email` 
    - ✅ Changed `member.userDisplayName` to `member.user?.displayName`

## Additional Tasks
- Create data migration scripts for production
- Update tests to use PostgreSQL
- Document schema changes
- Add proper error handling for database operations