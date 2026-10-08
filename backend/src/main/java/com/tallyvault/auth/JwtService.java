package com.tallyvault.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final SecretKey signingKey;
    private final Duration expiration;

    public JwtService(@Value("${tallyvault.jwt.secret}") String secret,
                      @Value("${tallyvault.jwt.expiration-minutes}") long expirationMinutes) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("JWT secret must be at least 32 bytes");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = Duration.ofMinutes(expirationMinutes);
    }

    public String create(User user) {
        Instant now = Instant.now();
        return Jwts.builder().subject(user.getEmail())
            .claim("uid", user.getId().toString()).claim("role", user.getRole().name())
            .issuedAt(Date.from(now)).expiration(Date.from(now.plus(expiration)))
            .signWith(signingKey).compact();
    }

    public String subject(String token) {
        Claims claims = Jwts.parser().verifyWith(signingKey).build()
            .parseSignedClaims(token).getPayload();
        return claims.getSubject();
    }
}

