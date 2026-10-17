package com.smashflow.repository;

import com.smashflow.model.Role;
import com.smashflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    /**
     * Khóa dòng user (SELECT ... FOR UPDATE) mà không nạp entity, để các lần điểm danh của cùng một
     * thành viên chạy tuần tự và tính lại số buổi luôn chính xác.
     */
    @Query(value = "SELECT id FROM users WHERE id = :id FOR UPDATE", nativeQuery = true)
    List<Long> lockRowById(@Param("id") Long id);

    Optional<User> findByPhone(String phone);
    boolean existsByPhone(String phone);
    List<User> findByRole(Role role);
    List<User> findByMembershipType(com.smashflow.model.MembershipType membershipType);
    List<User> findAllByOrderByCreatedAtDesc();
    List<User> findTop20ByOrderBySessionsAttendedDesc();
    List<User> findTop20ByOrderByWinCountDesc();

    /** Bảng xếp hạng chuyên cần: bỏ tài khoản đã xóa (kể cả đã ẩn danh hóa) và tài khoản GUEST. */
    @Query("SELECT u FROM User u WHERE (u.deleted IS NULL OR u.deleted = false) " +
           "AND u.role <> com.smashflow.model.Role.GUEST " +
           "ORDER BY COALESCE(u.sessionsAttended, 0) DESC, u.id ASC")
    List<User> findAttendanceLeaderboard();

    /** Bảng xếp hạng Elo: LP giảm dần, hòa thì nhiều trận thắng hơn đứng trên. */
    @Query("SELECT u FROM User u WHERE (u.deleted IS NULL OR u.deleted = false) " +
           "AND u.role <> com.smashflow.model.Role.GUEST " +
           "ORDER BY COALESCE(u.eloScore, 0) DESC, COALESCE(u.winCount, 0) DESC, u.id ASC")
    List<User> findEloLeaderboard();
}

