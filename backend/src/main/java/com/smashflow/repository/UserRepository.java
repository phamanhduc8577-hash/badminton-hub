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
}

