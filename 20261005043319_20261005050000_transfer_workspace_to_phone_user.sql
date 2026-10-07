/*
# Transfer workspace ownership to phone-based user and fix claim function

1. Purpose
- The workspace was originally claimed by the email-based test user (mukeshcho2019@gmail.com).
- The user now logs in with mobile number 7339732156 (internal email: 917339732156@mukesh.app, user_id: 4b23e0a9-8a4b-442c-bd94-eb9ffd45492d).
- The claim_legacy_workspace function throws "Workspace already claimed" for the new user, causing the app to get stuck on "Securing your workspace…" with no data loading.

2. Changes
- Transfer app_owner_claim ownership to the phone-based user.
- Reassign all categories, accounts, ledgers, and transactions to the phone-based user.
- Update claim_legacy_workspace to silently return (no error) when the workspace is already claimed by a different user, instead of throwing. This prevents the app from getting stuck for secondary users.

3. Security
- No new tables or columns.
- RLS policies remain unchanged — still scoped to authenticated users with auth.uid() = user_id.
- The claim function remains SECURITY DEFINER but no longer throws for already-claimed state.
*/

-- Transfer workspace ownership to the phone-based user
UPDATE app_owner_claim
SET owner_id = '4b23e0a9-8a4b-442c-bd94-eb9ffd45492d',
    claimed_at = now()
WHERE id = true;

-- Reassign all existing data to the phone-based user
UPDATE categories SET user_id = '4b23e0a9-8a4b-442c-bd94-eb9ffd45492d' WHERE user_id IS NOT NULL;
UPDATE accounts SET user_id = '4b23e0a9-8a4b-442c-bd94-eb9ffd45492d' WHERE user_id IS NOT NULL;
UPDATE ledgers SET user_id = '4b23e0a9-8a4b-442c-bd94-eb9ffd45492d' WHERE user_id IS NOT NULL;
UPDATE transactions SET user_id = '4b23e0a9-8a4b-442c-bd94-eb9ffd45492d' WHERE user_id IS NOT NULL;

-- Fix the claim function: don't throw when already claimed by another user
CREATE OR REPLACE FUNCTION claim_legacy_workspace()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  current_owner uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT owner_id INTO current_owner
  FROM app_owner_claim
  WHERE id = true
  FOR UPDATE;

  -- If already claimed by this user, nothing to do
  IF current_owner IS NOT NULL AND current_owner = caller_id THEN
    RETURN;
  END IF;

  -- If claimed by someone else, silently return — the caller gets their own empty workspace
  IF current_owner IS NOT NULL AND current_owner <> caller_id THEN
    RETURN;
  END IF;

  -- Only claim if nobody has claimed yet
  IF current_owner IS NULL THEN
    UPDATE app_owner_claim
    SET owner_id = caller_id, claimed_at = now()
    WHERE id = true;

    UPDATE categories SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE accounts SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE ledgers SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE transactions SET user_id = caller_id WHERE user_id IS NULL;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_legacy_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_legacy_workspace() TO authenticated;
