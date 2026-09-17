-- Create advent_calendar_rewards table
CREATE TABLE IF NOT EXISTS advent_calendar_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number >= 1 AND day_number <= 24),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎁',
  reward_type TEXT NOT NULL DEFAULT 'bonus', -- bonus, points, raffle_entry, etc.
  reward_value TEXT, -- e.g., "50 Free Spins", "100 Points", etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create advent_calendar_claims table
CREATE TABLE IF NOT EXISTS advent_calendar_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 24),
  reward_id UUID NOT NULL REFERENCES advent_calendar_rewards(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_advent_claims_user_id ON advent_calendar_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_advent_claims_day_number ON advent_calendar_claims(day_number);

-- Insert default rewards for all 24 days
INSERT INTO advent_calendar_rewards (day_number, title, description, icon, reward_type, reward_value) VALUES
(1, '50 Bonus Spins', 'Enjoy 50 free spins on featured slots!', '🎁', 'bonus', '50 Free Spins'),
(2, 'VIP Points Boost', 'Earn double VIP points for 24 hours!', '💎', 'points', '2x Points'),
(3, '$25 Bonus Cash', 'Instant $25 bonus added to your account!', '🎰', 'bonus', '$25'),
(4, 'Raffle Entry', 'Exclusive entry into the Grand Prize raffle!', '🏆', 'raffle_entry', '1 Entry'),
(5, '100 Free Spins', '100 spins on premium slot games!', '💰', 'bonus', '100 Free Spins'),
(6, 'Cashback Boost', '25% extra cashback for 48 hours!', '⭐', 'bonus', '25% Cashback'),
(7, 'Mystery Box', 'Open a mystery box with guaranteed rewards!', '🎲', 'mystery', 'Mystery Reward'),
(8, 'VIP Upgrade', '7-day VIP status upgrade!', '👑', 'vip', '7 Days VIP'),
(9, '$50 Bonus', 'Massive $50 bonus cash reward!', '💸', 'bonus', '$50'),
(10, 'Lucky Spin', 'Spin the mega wheel for prizes up to $500!', '🌟', 'bonus', 'Mega Wheel'),
(11, '200 Free Spins', '200 spins on top-rated games!', '🎊', 'bonus', '200 Free Spins'),
(12, 'Loyalty Bonus', 'Special loyalty reward package!', '💝', 'bonus', 'Loyalty Package'),
(13, 'Hot Streak', 'Triple rewards on your next deposit!', '🔥', 'bonus', '3x Deposit'),
(14, 'Instant Win', 'Guaranteed cash prize between $10-$100!', '🎯', 'bonus', '$10-$100'),
(15, 'Golden Ticket', 'Access to exclusive VIP tournament!', '✨', 'tournament', 'VIP Tournament'),
(16, 'Bonus Bundle', 'Mega bundle: Spins + Cash + VIP Points!', '🎪', 'bundle', 'Mega Bundle'),
(17, 'Rainbow Jackpot', 'Entry into progressive jackpot draw!', '🌈', 'jackpot', 'Jackpot Entry'),
(18, 'Star Reward', '5 raffle tickets for the mega giveaway!', '💫', 'raffle_entry', '5 Tickets'),
(19, 'Premium Access', '30-day premium community access!', '🎨', 'vip', '30 Days Premium'),
(20, 'Rocket Boost', 'Your winnings boosted by 50% for 24h!', '🚀', 'bonus', '50% Boost'),
(21, 'Special Event', 'Invite to exclusive VIP-only event!', '🎭', 'event', 'VIP Event'),
(22, 'Diamond Package', 'Ultimate reward package worth $200+!', '💎', 'bundle', 'Diamond Package'),
(23, 'Champion Bonus', 'Become eligible for Champion rewards tier!', '🏅', 'vip', 'Champion Tier'),
(24, 'MEGA PRIZE', 'Grand finale: $500 cash + 1000 spins!', '🎁', 'mega', '$500 + 1000 Spins')
ON CONFLICT (day_number) DO NOTHING;
