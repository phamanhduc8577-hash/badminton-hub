# Stage 1: Build with Gradle
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .

RUN chmod +x ./gradlew
COPY src src
RUN ./gradlew bootJar -x test --no-daemon

# Stage 2: Minimal JRE Runtime with Memory Optimization
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8081

# JVM flags to fit in 512MB RAM (Free tier limit)
ENTRYPOINT ["java", "-XX:+UseSerialGC", "-Xss512k", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
