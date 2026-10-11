package com.smashflow.repository;

import com.smashflow.model.LoyaltyReward;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LoyaltyRewardRepository extends JpaRepository<LoyaltyReward, Long> {
    List<LoyaltyReward> findByUserIdOrderByMilestoneSessionsAsc(Long userId);
    Optional<LoyaltyReward> findByUserIdAndMilestoneSessions(Long userId, Integer milestoneSessions);
    List<LoyaltyReward> findByUserIdAndIsClaimedFalseOrderByMilestoneSessionsAsc(Long userId);

    /** Khóa dòng quà khi Host xác nhận đã trao, tránh bấm đúp / thao tác song song. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM LoyaltyReward r WHERE r.id = :id")
    Optional<LoyaltyReward> findByIdForUpdate(@Param("id") Long id);

    /** Quà vật lý đã đủ điều kiện nhưng Host chưa trao (loại trừ các mốc voucher vì voucher tự trừ khi đăng ký ca). */
    @Query("SELECT r FROM LoyaltyReward r JOIN FETCH r.user u " +
           "WHERE r.isClaimed = false AND r.milestoneSessions NOT IN :voucherMilestones " +
           "ORDER BY r.createdAt ASC")
    List<LoyaltyReward> findPendingPhysicalRewards(@Param("voucherMilestones") Collection<Integer> voucherMilestones);
}
