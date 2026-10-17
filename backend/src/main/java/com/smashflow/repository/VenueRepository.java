package com.smashflow.repository;

import com.smashflow.model.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findFirstByNameIgnoreCaseAndAddressIgnoreCaseOrderByIdAsc(String name, String address);
}
