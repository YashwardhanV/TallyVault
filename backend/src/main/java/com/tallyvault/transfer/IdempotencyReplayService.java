package com.tallyvault.transfer;

import com.tallyvault.common.ApiException;
import com.tallyvault.transaction.TransactionMapper;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdempotencyReplayService {
    private final IdempotencyRecordRepository records;
    public IdempotencyReplayService(IdempotencyRecordRepository records) { this.records = records; }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public Optional<TransferDtos.TransactionResponse> replay(String key, String expectedHash) {
        return records.findWithTransactionByKey(key).map(record -> {
            if (!record.getRequestHash().equals(expectedHash)) {
                throw ApiException.conflict("idempotency_key_reused",
                    "idempotency key was already used for a different request");
            }
            return TransactionMapper.response(record.getTransaction(), true);
        });
    }
}

