package com.smashflow.config;

import com.smashflow.repository.UserRepository;
import com.smashflow.repository.VenueRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DataInitializerIndexTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final DataInitializer init = new DataInitializer(mock(UserRepository.class), mock(VenueRepository.class),
            mock(PasswordEncoder.class), jdbc);

    @Test
    @DisplayName("Không còn nhóm trùng (session_id, user_id) → tạo chỉ mục duy nhất có điều kiện")
    void createsIndexWhenNoDuplicates() {
        when(jdbc.queryForObject(DataInitializer.DUPLICATE_PARTICIPANT_GROUPS_SQL, Long.class)).thenReturn(0L);
        assertTrue(init.ensureParticipantUniqueIndex());
        verify(jdbc).execute(DataInitializer.CREATE_PARTICIPANT_UNIQUE_INDEX_SQL);
        assertTrue(DataInitializer.CREATE_PARTICIPANT_UNIQUE_INDEX_SQL.contains("WHERE user_id IS NOT NULL"));
    }

    @Test
    @DisplayName("Còn bản ghi trùng → chỉ cảnh báo, không tạo chỉ mục, không xóa dữ liệu")
    void skipsIndexWhenDuplicates() {
        when(jdbc.queryForObject(DataInitializer.DUPLICATE_PARTICIPANT_GROUPS_SQL, Long.class)).thenReturn(3L);
        assertFalse(init.ensureParticipantUniqueIndex());
        verify(jdbc, never()).execute(anyString());
        verify(jdbc, never()).update(anyString());
    }
}
