-- Server-authoritative RPCs for expenses with idempotency and versioning

CREATE OR REPLACE FUNCTION public.upsert_expense(
    p_id TEXT,
    p_workspace_identifier TEXT,
    p_name TEXT,
    p_amount NUMERIC(12, 2),
    p_category TEXT,
    p_date TEXT,
    p_time TEXT,
    p_direction TEXT,
    p_payment_method TEXT,
    p_billing_cycle TEXT,
    p_notes TEXT,
    p_bank_name TEXT,
    p_masked_account TEXT,
    p_account_last4 TEXT,
    p_reference_id TEXT,
    p_sms_reference_id TEXT,
    p_upi_reference TEXT,
    p_raw_sms_text TEXT,
    p_merchant TEXT,
    p_payee TEXT,
    p_source TEXT,
    p_source_file TEXT,
    p_import_batch_id TEXT,
    p_active BOOLEAN,
    p_client_updated_at BIGINT,
    p_expected_version BIGINT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_current_version BIGINT;
    v_is_deleted BOOLEAN;
    v_result RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Check if record exists
    SELECT version, is_deleted INTO v_current_version, v_is_deleted
    FROM public.user_expenses
    WHERE id = p_id AND (user_id = v_user_id OR workspace_identifier = p_workspace_identifier);

    IF FOUND THEN
        -- If already deleted, cannot resurrect via update
        IF v_is_deleted THEN
            RAISE EXCEPTION 'Cannot update a deleted record';
        END IF;

        -- Check expected version (optimistic concurrency control)
        -- If p_expected_version is passed as 0 or null, we might ignore version check for forced overwrites,
        -- but ideally we enforce it.
        IF p_expected_version IS NOT NULL AND p_expected_version != v_current_version THEN
            RAISE EXCEPTION 'Conflict: expected version % does not match current version %', p_expected_version, v_current_version;
        END IF;

        -- Update
        UPDATE public.user_expenses
        SET
            name = p_name,
            amount = p_amount,
            category = p_category,
            date = p_date,
            time = p_time,
            direction = p_direction,
            payment_method = p_payment_method,
            billing_cycle = p_billing_cycle,
            notes = p_notes,
            bank_name = p_bank_name,
            masked_account = p_masked_account,
            account_last4 = p_account_last4,
            reference_id = p_reference_id,
            sms_reference_id = p_sms_reference_id,
            upi_reference = p_upi_reference,
            raw_sms_text = p_raw_sms_text,
            merchant = p_merchant,
            payee = p_payee,
            source = p_source,
            source_file = p_source_file,
            import_batch_id = p_import_batch_id,
            active = p_active,
            updated_at = timezone('utc'::text, now()),
            client_updated_at = p_client_updated_at,
            version = v_current_version + 1
        WHERE id = p_id
        RETURNING * INTO v_result;

        RETURN to_jsonb(v_result);
    ELSE
        -- Insert
        IF p_expected_version IS NOT NULL AND p_expected_version > 1 THEN
            RAISE EXCEPTION 'Conflict: record does not exist but expected version is %', p_expected_version;
        END IF;

        INSERT INTO public.user_expenses (
            id, user_id, workspace_identifier, user_email, name, amount, category, date, time,
            direction, payment_method, billing_cycle, notes, bank_name, masked_account, account_last4,
            reference_id, sms_reference_id, upi_reference, raw_sms_text, merchant, payee, source,
            source_file, import_batch_id, active, is_deleted, client_updated_at, version
        ) VALUES (
            p_id, v_user_id, p_workspace_identifier, v_user_email, p_name, p_amount, p_category, p_date, p_time,
            p_direction, p_payment_method, p_billing_cycle, p_notes, p_bank_name, p_masked_account, p_account_last4,
            p_reference_id, p_sms_reference_id, p_upi_reference, p_raw_sms_text, p_merchant, p_payee, p_source,
            p_source_file, p_import_batch_id, p_active, false, p_client_updated_at, 1
        )
        RETURNING * INTO v_result;

        RETURN to_jsonb(v_result);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_expense(
    p_id TEXT,
    p_workspace_identifier TEXT,
    p_expected_version BIGINT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_version BIGINT;
    v_is_deleted BOOLEAN;
    v_result RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT version, is_deleted INTO v_current_version, v_is_deleted
    FROM public.user_expenses
    WHERE id = p_id AND (user_id = v_user_id OR workspace_identifier = p_workspace_identifier);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Record not found';
    END IF;

    IF v_is_deleted THEN
        -- Already deleted, just return it
        SELECT * INTO v_result FROM public.user_expenses WHERE id = p_id;
        RETURN to_jsonb(v_result);
    END IF;

    IF p_expected_version IS NOT NULL AND p_expected_version != v_current_version THEN
        RAISE EXCEPTION 'Conflict: expected version % does not match current version %', p_expected_version, v_current_version;
    END IF;

    UPDATE public.user_expenses
    SET
        is_deleted = true,
        deleted_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now()),
        version = v_current_version + 1
    WHERE id = p_id
    RETURNING * INTO v_result;

    RETURN to_jsonb(v_result);
END;
$$;
