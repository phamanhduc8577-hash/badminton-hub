package com.smashflow.repository;

import com.smashflow.model.LoyaltyReward;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoyaltyRewardRepository extends JpaRepository<LoyaltyReward, Long> {
    List<LoyaltyReward> findByUserIdOrderByMilestoneSessionsAsc(Long userId);
    Optional<LoyaltyReward> findByUserIdAndMilestoneSessions(Long userId, Integer milestoneSessions);
}
