package com.smashflow.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smashflow.dto.CreateSessionRequest;
import com.smashflow.dto.MatchResponse;
import com.smashflow.model.WinningTeam;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@JsonTest
@Import(JacksonConfig.class)
public class JacksonConfigTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    public void testLocalDateTimeSerializationFormat() throws Exception {
        LocalDateTime sampleTime = LocalDateTime.of(2026, 9, 15, 15, 52, 30);
        MatchResponse matchResponse = MatchResponse.builder()
                .id(1L)
                .sessionId(10L)
                .courtName("Sân 7")
                .winningTeam(WinningTeam.A)
                .createdAt(sampleTime)
                .build();

        String json = objectMapper.writeValueAsString(matchResponse);
        assertThat(json).contains("\"createdAt\":\"2026-09-15T15:52:30\"");
    }

    @Test
    public void testLocalDateTimeDeserializationWithAndWithoutSeconds() throws Exception {
        // Test parsing with seconds (e.g. from DB or standard API)
        String jsonWithSec = "{\"startTime\":\"2026-09-19T13:00:00\"}";
        CreateSessionRequest reqWithSec = objectMapper.readValue(jsonWithSec, CreateSessionRequest.class);
        assertThat(reqWithSec.getStartTime()).isEqualTo(LocalDateTime.of(2026, 9, 19, 13, 0, 0));

        // Test parsing WITHOUT seconds (e.g. from HTML5 datetime-local "2026-09-19T13:00")
        String jsonWithoutSec = "{\"startTime\":\"2026-09-19T13:00\"}";
        CreateSessionRequest reqWithoutSec = objectMapper.readValue(jsonWithoutSec, CreateSessionRequest.class);
        assertThat(reqWithoutSec.getStartTime()).isEqualTo(LocalDateTime.of(2026, 9, 19, 13, 0, 0));
    }
}
