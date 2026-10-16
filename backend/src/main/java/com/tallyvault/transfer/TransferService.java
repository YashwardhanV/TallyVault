package com.tallyvault.transfer;

import com.tallyvault.auth.User;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class TransferService {
    private final TransferCreationService creation;
    private final IdempotencyReplayService replays;
    public TransferService(TransferCreationService creation, IdempotencyReplayService replays) {
        this.creation = creation;
        this.replays = replays;
    }

    public TransferDtos.TransactionResponse transfer(
        String rawKey, TransferDtos.TransferRequest request, User actor) {
        String key = validateKey(rawKey);
        String hash = RequestHasher.transfer(request);
        try {
            return creation.create(key, hash, request, actor);
        } catch (DataIntegrityViolationException collisionOrConstraint) {
            return replays.replay(key, hash).orElseThrow(() -> collisionOrConstraint);
        }
    }

    static String validateKey(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) throw new IllegalArgumentException("Idempotency-Key header is required");
        String key = rawKey.strip();
        if (key.length() > 80) throw new IllegalArgumentException("Idempotency-Key must be at most 80 characters");
        return key;
    }
}
