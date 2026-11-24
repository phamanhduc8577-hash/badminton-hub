package com.smashflow.repository;

import com.smashflow.model.SepayWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SepayWebhookEventRepository extends JpaRepository<SepayWebhookEvent, Long> {

    boolean existsBySepayTransactionId(Long sepayTransactionId);

    Optional<SepayWebhookEvent> findBySepayTransactionId(Long sepayTransactionId);

    List<SepayWebhookEvent> findTop50ByOrderByCreatedAtDesc();
}
