-- RPC function to atomically commit the entire PLG setup

CREATE OR REPLACE FUNCTION create_initial_household_setup(
    p_household_name TEXT,
    p_members JSONB, -- Array of objects: { name: string, is_child: boolean }
    p_bills JSONB, -- Array of objects: { name: string, amount: numeric, account: string, interval: string }
    p_incomes JSONB -- Array of objects: { name: string, amount: numeric, account: string }
) RETURNS JSONB AS $$
DECLARE
    v_household_id UUID;
    v_member RECORD;
    v_bill RECORD;
    v_income RECORD;
    v_member_id UUID;
BEGIN
    -- 1. Create Household
    INSERT INTO households (name) VALUES (p_household_name) RETURNING id INTO v_household_id;
    
    -- 2. Link creator (the user calling this) to the household
    UPDATE profiles 
    SET household_id = v_household_id, role = 'owner', setup_status = 'completed'
    WHERE id = auth.uid();
    
    -- 3. Create members (Accounts)
    FOR v_member IN SELECT * FROM jsonb_to_recordset(p_members) AS x(name text, is_child boolean)
    LOOP
        INSERT INTO accounts (id, household_id, name, type) 
        VALUES (gen_random_uuid(), v_household_id, v_member.name, 'person')
        RETURNING id INTO v_member_id;
        
        -- Default: If it's the first member, try to link it to the user's profile if we had a mapping (skipped for simplicity here)
    END LOOP;
    
    -- 4. Create bills
    IF p_bills IS NOT NULL THEN
        FOR v_bill IN SELECT * FROM jsonb_to_recordset(p_bills) AS x(name text, amount numeric, account text, interval text, normalized_name text, transaction_direction text, source text, bank_name text)
        LOOP
            -- Get account_id based on name matching (simplification, real logic might pass account_id directly if possible, or we resolve it here)
            -- For atomic setup, if the UI passes account names, we resolve them to IDs
            INSERT INTO bills (id, household_id, name, default_amount, account_id, interval, split_type)
            SELECT gen_random_uuid(), v_household_id, v_bill.name, v_bill.amount, a.id, COALESCE(v_bill.interval, 'all'), 'proportional'
            FROM accounts a
            WHERE a.household_id = v_household_id AND a.name = v_bill.account
            LIMIT 1;

            -- Auto-learn rule for this bill locally
            INSERT INTO household_import_rules (household_id, search_string, target_id, rule_target_type, is_bill, rule_type, usage_count)
            SELECT v_household_id, UPPER(v_bill.name), a.id, 'ACCOUNT', true, 'USER', 5
            FROM accounts a
            WHERE a.household_id = v_household_id AND a.name = v_bill.account
            LIMIT 1;

            -- Log to global learning
            IF v_bill.normalized_name IS NOT NULL THEN
                INSERT INTO public.global_learning_votes (
                    household_id, normalized_name, transaction_direction, category, source, bank_name, normalization_version
                )
                VALUES (
                    v_household_id, v_bill.normalized_name, v_bill.transaction_direction::public.transaction_direction_enum, 'BILL'::public.learning_category_enum, COALESCE(v_bill.source, 'ONBOARDING')::public.learning_source_enum, v_bill.bank_name, 1
                )
                ON CONFLICT (household_id, normalized_name, transaction_direction, category) 
                DO UPDATE SET is_active = true, updated_at = now();
            END IF;
        END LOOP;
    END IF;
    
    -- 5. Create incomes
    IF p_incomes IS NOT NULL THEN
        FOR v_income IN SELECT * FROM jsonb_to_recordset(p_incomes) AS x(name text, amount numeric, account text, type text, pay_date text, normalized_name text, transaction_direction text, source text, bank_name text)
        LOOP
            INSERT INTO user_incomes (id, household_id, name, amount, type, pay_date, user_id)
            VALUES (gen_random_uuid(), v_household_id, v_income.name, v_income.amount, COALESCE(v_income.type, 'fixed'), CASE WHEN v_income.pay_date IS NOT NULL THEN v_income.pay_date::DATE ELSE NULL END, auth.uid());

            -- Auto-learn rule for this income locally
            INSERT INTO household_import_rules (household_id, search_string, target_id, rule_target_type, is_bill, rule_type, usage_count)
            VALUES (v_household_id, UPPER(v_income.name), auth.uid(), 'USER', false, 'USER', 5);

            -- Log to global learning
            IF v_income.normalized_name IS NOT NULL THEN
                INSERT INTO public.global_learning_votes (
                    household_id, normalized_name, transaction_direction, category, source, bank_name, normalization_version
                )
                VALUES (
                    v_household_id, v_income.normalized_name, v_income.transaction_direction::public.transaction_direction_enum, 
                    CASE WHEN v_income.type = 'variable' THEN 'VARIABLE_INCOME'::public.learning_category_enum ELSE 'FIXED_INCOME'::public.learning_category_enum END, 
                    COALESCE(v_income.source, 'ONBOARDING')::public.learning_source_enum, v_income.bank_name, 1
                )
                ON CONFLICT (household_id, normalized_name, transaction_direction, category) 
                DO UPDATE SET is_active = true, updated_at = now();
            END IF;
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'household_id', v_household_id);
EXCEPTION WHEN OTHERS THEN
    -- In case of ANY error, the transaction is rolled back automatically
    RAISE EXCEPTION 'Atomic setup failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
