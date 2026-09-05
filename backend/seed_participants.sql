INSERT INTO session_participants (session_id, user_id, is_guest, guest_name, guest_phone, gender, checkin_status, deposit_status, deposit_amount, base_fee, adjustment_amount, final_fee, payment_status, created_at, updated_at)
VALUES
(2, 2, false, null, null, 'MALE', 'CHECKED_IN', 'NONE', 0, 50000, 0, 50000, 'PAID', NOW(), NOW()),
(2, 3, false, null, null, 'FEMALE', 'CHECKED_IN', 'NONE', 0, 40000, 0, 40000, 'PAID', NOW(), NOW()),
(2, 5, false, null, null, 'MALE', 'CHECKED_IN', 'NONE', 0, 50000, 0, 50000, 'UNPAID', NOW(), NOW()),
(2, 6, false, null, null, 'MALE', 'CHECKED_IN', 'NONE', 0, 50000, 0, 50000, 'UNPAID', NOW(), NOW()),
(2, 7, false, null, null, 'FEMALE', 'CHECKED_IN', 'NONE', 0, 40000, 0, 40000, 'PAID', NOW(), NOW()),
(2, null, true, 'Bùi Tiến Dũng', '0933112233', 'MALE', 'CHECKED_IN', 'PAID', 20000, 60000, 0, 60000, 'UNPAID', NOW(), NOW()),
(2, null, true, 'Ngô Phương Anh', '0977889900', 'FEMALE', 'CHECKED_IN', 'PAID', 20000, 50000, 0, 50000, 'PAID', NOW(), NOW());
