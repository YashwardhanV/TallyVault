FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S tallyvault && adduser -S tallyvault -G tallyvault
WORKDIR /app
COPY --from=build /workspace/target/tallyvault-backend-0.1.0-SNAPSHOT.jar app.jar
USER tallyvault
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

