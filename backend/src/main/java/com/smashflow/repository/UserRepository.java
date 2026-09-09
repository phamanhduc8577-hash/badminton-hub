package com.smashflow.repository;

import com.smashflow.model.Role;
import com.smashflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByPhone(String phone);
    boolean existsByPhone(String phone);
    List<User> findByRole(Role role);
    List<User> findByMembershipType(com.smashflow.model.MembershipType membershipType);
    List<User> findAllByOrderByCreatedAtDesc();
    List<User> findTop20ByOrderBySessionsAttendedDesc();
    List<User> findTop20ByOrderByWinCountDesc();
}

