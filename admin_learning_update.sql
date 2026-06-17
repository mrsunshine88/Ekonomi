CREATE OR REPLACE FUNCTION public.admin_approve_system_rule(
    p_normalized_name TEXT,
    p_transaction_direction TEXT,
    p_original_category TEXT,
    p_new_category TEXT,
    p_household_count INTEGER
) RETURNS void AS $$
BEGIN
    -- Dubbelkolla admin-status
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Skapa SYSTEM-regel baserat på NYA kategorin
    INSERT INTO public.household_import_rules (
        household_id, 
        search_string, 
        is_bill, 
        rule_type, 
        usage_count, 
        matched_examples
    )
    VALUES (
        null, 
        p_normalized_name, 
        (p_new_category = 'BILL'), 
        'SYSTEM', 
        p_household_count, 
        '[]'::jsonb
    );

    -- Avaktivera de URSPRUNGLIGA rösterna så de försvinner från kandidat-listan
    UPDATE public.global_learning_votes
    SET is_active = false
    WHERE normalized_name = p_normalized_name
      AND transaction_direction::TEXT = p_transaction_direction
      AND category::TEXT = p_original_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ny funktion för att neka / radera en kandidat
CREATE OR REPLACE FUNCTION public.admin_reject_system_rule(
    p_normalized_name TEXT,
    p_transaction_direction TEXT,
    p_category TEXT
) RETURNS void AS $$
BEGIN
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Avaktivera rösterna (neka)
    UPDATE public.global_learning_votes
    SET is_active = false
    WHERE normalized_name = p_normalized_name
      AND transaction_direction::TEXT = p_transaction_direction
      AND category::TEXT = p_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
