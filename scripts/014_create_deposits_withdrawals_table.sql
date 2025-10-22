-- Create deposits_withdrawals table
CREATE TABLE IF NOT EXISTS deposits_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  withdraw_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial row
INSERT INTO deposits_withdrawals (deposit_amount, withdraw_amount)
VALUES (0, 0)
ON CONFLICT DO NOTHING;
