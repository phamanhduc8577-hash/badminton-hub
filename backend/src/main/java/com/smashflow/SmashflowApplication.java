package com.smashflow;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class SmashflowApplication {

    public static void main(String[] args) {
        SpringApplication.run(SmashflowApplication.class, args);
    }
}
