INSERT INTO users (phone, password, full_name, gender, role, sessions_attended, win_count, loss_count, created_at, updated_at)
VALUES
('0933112233', '$2a$10$abcdefg', 'Bùi Tiến Dũng', 'MALE', 'GUEST', 1, 0, 0, NOW(), NOW()),
('0977889900', '$2a$10$abcdefg', 'Ngô Phương Anh', 'FEMALE', 'GUEST', 1, 0, 0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

UPDATE session_participants SET user_id = (SELECT id FROM users WHERE phone = '0933112233') WHERE session_id = 2 AND guest_phone = '0933112233';
UPDATE session_participants SET user_id = (SELECT id FROM users WHERE phone = '0977889900') WHERE session_id = 2 AND guest_phone = '0977889900';
