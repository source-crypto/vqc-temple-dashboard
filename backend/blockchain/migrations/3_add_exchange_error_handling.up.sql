-- Add error handling and monitoring for currency exchange operations

CREATE TABLE IF NOT EXISTS exchange_error_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT,
  operation_type TEXT NOT NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  request_data JSONB,
  exchange_rate_at_time DECIMAL(20, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rate_history (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  currency_pair TEXT NOT NULL,
  rate DECIMAL(20, 8) NOT NULL,
  volume_24h DECIMAL(20, 2) DEFAULT 0,
  change_24h DECIMAL(10, 4) DEFAULT 0,
  market_cap DECIMAL(20, 2) DEFAULT 0,
  source TEXT DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clean up any invalid data before adding constraints
UPDATE currency_exchange_rates SET rate = 0.0000001 WHERE rate <= 0;
UPDATE user_balances SET balance = 0 WHERE balance < 0;
UPDATE user_balances SET locked_balance = 0 WHERE locked_balance < 0;

-- Ensure exchange rates table has proper constraints
DO $$
BEGIN
  -- Add constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_positive_rate' 
    AND table_name = 'currency_exchange_rates'
  ) THEN
    ALTER TABLE currency_exchange_rates 
    ADD CONSTRAINT check_positive_rate CHECK (rate > 0);
  END IF;
END $$;

DO $$
BEGIN
  -- Add constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_valid_currency_pair' 
    AND table_name = 'currency_exchange_rates'
  ) THEN
    ALTER TABLE currency_exchange_rates 
    ADD CONSTRAINT check_valid_currency_pair CHECK (currency_pair ~ '^[A-Z]{2,10}/[A-Z]{2,10}$');
  END IF;
END $$;

-- Ensure user balances have proper constraints
DO $$
BEGIN
  -- Add constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_non_negative_balance' 
    AND table_name = 'user_balances'
  ) THEN
    ALTER TABLE user_balances 
    ADD CONSTRAINT check_non_negative_balance CHECK (balance >= 0);
  END IF;
END $$;

DO $$
BEGIN
  -- Add constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_non_negative_locked_balance' 
    AND table_name = 'user_balances'
  ) THEN
    ALTER TABLE user_balances 
    ADD CONSTRAINT check_non_negative_locked_balance CHECK (locked_balance >= 0);
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exchange_error_logs_timestamp ON exchange_error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_exchange_error_logs_user_id ON exchange_error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_error_logs_operation ON exchange_error_logs(operation_type);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_timestamp ON exchange_rate_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_pair ON exchange_rate_history(currency_pair);

-- Add triggers for automatic rate history logging
CREATE OR REPLACE FUNCTION log_exchange_rate_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO exchange_rate_history (
    currency_pair, rate, volume_24h, change_24h, market_cap, source
  )
  VALUES (
    NEW.currency_pair, NEW.rate, NEW.volume_24h, NEW.change_24h, NEW.market_cap, 'update_trigger'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_exchange_rate_change ON currency_exchange_rates;
CREATE TRIGGER trigger_log_exchange_rate_change
  AFTER UPDATE ON currency_exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION log_exchange_rate_change();

-- Ensure default exchange rates exist with proper error handling
DO $$
BEGIN
  -- Only insert if no rates exist to avoid conflicts
  IF NOT EXISTS (SELECT 1 FROM currency_exchange_rates LIMIT 1) THEN
    INSERT INTO currency_exchange_rates (currency_pair, rate, volume_24h, change_24h, market_cap) VALUES
    ('ASM/USD', 0.0000125, 1500000.00, 5.25, 350000000.00),
    ('ASM/ETH', 0.000000005, 750000.00, -2.15, 350000000.00),
    ('ASM/BTC', 0.0000000003, 250000.00, 1.85, 350000000.00)
    ON CONFLICT (currency_pair) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error seeding exchange rates: %', SQLERRM;
END
$$;

-- Add table comments
COMMENT ON TABLE exchange_error_logs IS 'Error logs specific to currency exchange operations';
COMMENT ON TABLE exchange_rate_history IS 'Historical exchange rate data for analysis and auditing';
