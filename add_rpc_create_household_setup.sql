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
    SET household_id = v_household_id, role = 'owner', setup_status = 'readonly_user'
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
        FOR v_bill IN SELECT * FROM jsonb_to_recordset(p_bills) AS x(name text, amount numeric, account text, interval text)
        LOOP
            -- Get account_id based on name matching (simplification, real logic might pass account_id directly if possible, or we resolve it here)
            -- For atomic setup, if the UI passes account names, we resolve them to IDs
            INSERT INTO bills (id, household_id, name, default_amount, account_id, interval)
            SELECT gen_random_uuid(), v_household_id, v_bill.name, v_bill.amount, a.id, COALESCE(v_bill.interval, 'all')
            FROM accounts a
            WHERE a.household_id = v_household_id AND a.name = v_bill.account
            LIMIT 1;
        END LOOP;
    END IF;
    
    -- 5. Create incomes
    IF p_incomes IS NOT NULL THEN
        FOR v_income IN SELECT * FROM jsonb_to_recordset(p_incomes) AS x(name text, amount numeric, account text)
        LOOP
            INSERT INTO incomes (id, household_id, name, default_amount, account_id)
            SELECT gen_random_uuid(), v_household_id, v_income.name, v_income.amount, a.id
            FROM accounts a
            WHERE a.household_id = v_household_id AND a.name = v_income.account
            LIMIT 1;
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'household_id', v_household_id);
EXCEPTION WHEN OTHERS THEN
    -- In case of ANY error, the transaction is rolled back automatically
    RAISE EXCEPTION 'Atomic setup failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
