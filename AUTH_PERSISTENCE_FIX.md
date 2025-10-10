# Authentication Persistence Fix

## Issue
Users were being forced to sign in repeatedly when opening the app, even though they had previously authenticated.

## Root Causes Identified

### 1. **Auth Listener Recreation Loop**
The `useEffect` in `AuthContext.tsx` had `fetchCards` in its dependency array (implicitly through the auth listener). This caused:
- Auth listener to be recreated on every render
- Session state to become unstable
- Potential race conditions during token refresh

### 2. **Missing Cleanup in fetchCards**
The `fetchCards` function was setting loading state but not properly handling cleanup, which could cause state updates on unmounted components.

### 3. **Aggressive Card Fetching**
The auth listener was fetching cards on every auth event, including token refreshes, causing unnecessary database queries and potential session conflicts.

## Solutions Implemented

### 1. **Fixed Auth Listener Dependencies**
- Removed `fetchCards` dependency from the auth listener
- Auth listener now only updates user state, not cards
- Cards are fetched separately when needed by components

### 2. **Added Mounted State Tracking**
```typescript
let mounted = true;
// ... async operations check if (!mounted) return;
return () => {
  mounted = false;
  subscription.unsubscribe();
};
```
This prevents state updates after component unmount.

### 3. **Improved Session Validation**
- More specific error code checking (`PGRST301` for expired sessions)
- Better error handling with fallback refresh attempts
- Cleaner logging for debugging

### 4. **Removed Unnecessary Loading State**
- Removed `setLoading(true)` from `fetchCards` to prevent UI flicker
- Loading state only managed during initial auth check

### 5. **Enhanced Supabase Configuration**
- Added explicit `storageKey` for consistency across app restarts
- Added client info headers for better debugging
- Maintained optimal persistence settings

## Technical Flow

### App Startup
1. **AuthContext initializes** → checks SecureStore for saved session
2. **Session found** → validates with lightweight database query
3. **Session valid** → user stays signed in ✅
4. **Session expired** → automatically refreshes using refresh token
5. **Refresh successful** → user stays signed in ✅
6. **Refresh failed** → user redirected to login

### Token Refresh (Automatic)
1. **Supabase detects token expiration** (before it expires)
2. **Auto-refresh triggered** → uses stored refresh token
3. **TOKEN_REFRESHED event** → updates user state only
4. **No card refetch** → prevents unnecessary queries
5. **User stays signed in** ✅

### Auth State Changes
- **SIGNED_IN** → Set user state (cards fetched by components)
- **SIGNED_OUT** → Clear user and cards
- **TOKEN_REFRESHED** → Update user state only (no refetch)
- **USER_UPDATED** → Update user state only

## Configuration Settings

### Supabase Client (`lib/supabase.ts`)
```typescript
{
  auth: {
    autoRefreshToken: true,      // Auto-refresh before expiration
    persistSession: true,         // Save to SecureStore
    flowType: 'pkce',            // Secure auth flow
    storageKey: 'subtext-auth-token', // Consistent key
    storage: ExpoSecureStorageAdapter, // Cross-platform secure storage
  }
}
```

### Session Lifecycle
- **Access Token**: Expires after 1 hour
- **Refresh Token**: Expires after 30 days (default)
- **Auto-refresh**: Happens ~5 minutes before expiration
- **Storage**: SecureStore (iOS Keychain, Android Keystore)

## Benefits

✅ **Users stay signed in across app restarts**
- Session persists in secure storage
- Automatic validation on startup

✅ **Seamless token refresh**
- Happens automatically in background
- No user interruption

✅ **Better performance**
- Reduced unnecessary card fetches
- Fewer database queries

✅ **Improved stability**
- No auth listener recreation loops
- Proper cleanup prevents memory leaks

✅ **Enhanced debugging**
- Comprehensive logging
- Clear error messages

## Testing Checklist

- [ ] Sign in → Close app → Reopen → Should stay signed in
- [ ] Sign in → Wait 1+ hour → Use app → Token should auto-refresh
- [ ] Sign in → Force quit app → Reopen → Should stay signed in
- [ ] Sign in → Airplane mode → Reopen → Should show cached state
- [ ] Sign out → Close app → Reopen → Should show login screen
- [ ] Sign in on Device A → Sign in on Device B → Both should work independently

## Files Modified

1. **`/contexts/AuthContext.tsx`**
   - Fixed auth listener dependencies
   - Added mounted state tracking
   - Improved session validation
   - Removed aggressive card fetching

2. **`/lib/supabase.ts`**
   - Added explicit storage key
   - Added client info headers
   - Maintained optimal persistence settings

## Security Notes

- Sessions stored in platform-specific secure storage (Keychain/Keystore)
- PKCE flow provides additional security for mobile apps
- Refresh tokens are securely stored and never exposed
- Access tokens expire after 1 hour for security
- Automatic refresh happens before expiration

## Troubleshooting

### If users still report sign-in issues:

1. **Check Supabase Dashboard**
   - Verify JWT expiration settings
   - Check for rate limiting on auth endpoints

2. **Check Device Storage**
   - Ensure SecureStore has proper permissions
   - Verify storage isn't full

3. **Check Network**
   - Verify Supabase URL is accessible
   - Check for firewall/VPN issues

4. **Enable Debug Logging**
   - Set `debug: true` in supabase.ts temporarily
   - Check console for detailed auth flow

5. **Clear App Data** (last resort)
   - Uninstall and reinstall app
   - This clears SecureStore and forces fresh sign-in
